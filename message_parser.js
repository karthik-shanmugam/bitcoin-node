var stream = require('stream')
var util = require('util')
var btc = require('bitcoinjs-lib')
var Struct = require('struct')
var ctype = require('ctype')




var ctype_parser = new ctype.Parser({endian: "little"})
ctype_parser.typedef('net_addr',[
    {'time': {'type': 'uint32_t'}},
    {'services': {'type': 'uint64_t'}},
    {'ip_addr': {'type': 'uint8_t[16]'}},
    {'port': {'type': 'uint16_t'}}
    ])
ctype_parser.typedef('version_net_addr',[
    {'services': {'type': 'uint64_t'}},
    {'ip_addr': {'type': 'uint8_t[16]'}},
    {'port': {'type': 'uint16_t'}}
    ])
ctype_parser.typedef('version_header',[
    {'version': {'type': 'int32_t'}},
    {'services': {'type': 'uint64_t'}},
    {'timestamp': {'type': 'int64_t'}},
    {'addr_recv': {'type': 'version_net_addr'}},
    {'addr_from': {'type': 'version_net_addr'}},
    {'nonce': {'type': 'uint64_t'}}
    ])
ctype_parser.typedef('version_footer',[
    {'start_height': {'type': 'int32_t'}},
    {'relay': {'type': 'uint8_t'}}
    ])

function MessageStructs() {
    if (!(this instanceof MessageStructs)) {
        return new MessageStructs();
  } 
}
MessageStructs.prototype.parse_struct = function(buf, struct) {
    struct._setBuff(buf);
    return struct.fields;
}
MessageStructs.prototype.net_addr = Struct()
    .word32Ule('time')
    .word64Ule('services')
    .array('ip_addr', 16, "word8")
    .word16Ule('port')
MessageStructs.prototype.version_header = Struct()
    .word32Sle('version')
    .word64Ule('services')
    .word64Sle('timestamp')
    .struct('addr_recv', MessageStructs.prototype.net_addr)
    .struct('addr_from', MessageStructs.prototype.net_addr)
    .word64Ule('nonce')
MessageStructs.prototype.version_footer = Struct()
    .word32Sle('start_height')
    .word8('relay')

function MessageStream() {
  // allow use without new
  if (!(this instanceof MessageStream)) {
    return new MessageStream();
  }

  // init Transform
  stream.Transform.call(this, {objectMode: true});
}
util.inherits(MessageStream, stream.Transform);



var ParserState = {
    LF_MAGIC: 0,
    R_HEADER: 1,
    R_PAYLOAD: 2
}
var HEADER_LENGTH = 24;
MessageStream.prototype._transform = function (chunk, enc, cb) {
  var upperChunk = chunk.toString().toUpperCase();
  this.push(upperChunk);
  cb();
};



// initial stream state
MessageStream.prototype._message_buf = Buffer('', 'hex')
MessageStream.prototype._message_obj = {}
MessageStream.prototype._message_state = ParserState.LF_MAGIC
MessageStream.prototype._magic_depth = 0;
MessageStream.prototype._magic_buf = Buffer("F9BEB4D9", "hex")

// ugly recursion lol
MessageStream.prototype._process_chunk = function(chunk) {
    switch(this._message_state) {
        case ParserState.LF_MAGIC:
            for(var chunk_index = 0; chunk_index < chunk.length; chunk_index++) {
                if (this._magic_depth == this._magic_buf.length) {
                    this._magic_depth = 0
                    this._message_buf = new Buffer(this._magic_buf)
                    this._message_state = ParserState.R_HEADER
                    this._process_chunk(chunk.slice(chunk_index))
                    return

                } else if (this._magic_buf[this._magic_depth] == chunk[chunk_index]) {
                    this._magic_depth++
                } else {
                    this._magic_depth = 0;
                }
            }
            break;
        case ParserState.R_HEADER:
            // if the chunk does not contain the rest of the header add it to the buffer
            if (this._message_buf.length + chunk.length < HEADER_LENGTH) {
                this._message_buf = Buffer.concat([this._message_buf, chunk])
            } else {
                var remaining_header = chunk.slice(0, HEADER_LENGTH - this._message_buf.length)
                var payload_beginning = chunk.slice(HEADER_LENGTH - this._message_buf.length)

                this._message_buf = Buffer.concat([this._message_buf, remaining_header])

                this._message_obj.magic = this._message_buf.readUInt32LE(0);
                this._message_obj.command = this._message_buf.slice(4, 16);
                this._message_obj.payload_length = this._message_buf.readUInt32LE(16);
                this._message_obj.checksum = this._message_buf.slice(20, 24);

                this._message_state = ParserState.R_PAYLOAD
                this._process_chunk(payload_beginning)
            }
            break;
        case ParserState.R_PAYLOAD:
            if (this._message_buf.length + chunk.length < HEADER_LENGTH + this._message_obj.payload_length) {
                this._message_buf = Buffer.concat([this._message_buf, chunk])
            } else {
                var remaining_payload = chunk.slice(0, HEADER_LENGTH + this._message_obj.payload_length - this._message_buf.length)
                var magic_beginning = chunk.slice(HEADER_LENGTH + this._message_obj.payload_length - this._message_buf.length)
                
                this._message_buf = Buffer.concat([this._message_buf, remaining_payload])
                this._message_obj.payload = this._message_buf.slice(24)

                this.push(this._message_obj)
                this._message_obj = {}
                this._message_state = ParserState.LF_MAGIC
                this._message_buf = Buffer("", "hex")
                this._process_chunk(magic_beginning)
            }
            break;
        default:
            console.log("epic fail")  
        }
}
MessageStream.prototype._transform = function (chunk, encoding, done) {
    this._process_chunk(chunk)
    done()
}

function MessageEmitter() {
  // allow use without new
  if (!(this instanceof MessageEmitter)) {
    return new MessageEmitter();
  }

  // init Writable
  stream.Writable.call(this, {objectMode: true});
  this.messageStructs = new MessageStructs();
}
util.inherits(MessageEmitter, stream.Writable);

MessageEmitter.prototype._write = function(chunk, encoding, done) {
    var expected_checksum = chunk.checksum
    var calculated_checksum = btc.crypto.hash256(chunk.payload).slice(0, 4)
    if (expected_checksum.equals(calculated_checksum)) {
        var command = chunk.command.indexOf(0) == -1 ? chunk.command : chunk.command.slice(0, chunk.command.indexOf(0))
        switch (command.toString()) {
            case "version":


                // ctype module unpacking
                var payload = chunk.payload
                var version = {}
                var versionHeader = ctype_parser.readData([{"header": {"type": "version_header"}}], payload, 0)
                this.emit("version", versionHeader)


                // struct module unpacking
                // var payload = chunk.payload
                // var version = {}
                // var versionHeader = this.messageStructs.parse_struct(payload.slice(0, 80), this.messageStructs.version_header)
                // for (var attr in versionHeader) {version[attr] = versionHeader[attr]}
                // //var userAgentNullTerm = chunk.payload.indexOf(0, 80)
                // var userAgentLength = btc.bufferutils.readVarInt(payload, 80)
                // var versionAgent = payload.slice(80 + userAgentLength.size, 80 + userAgentLength.size + userAgentLength.number).toString()
                // version["user_agent"] = versionAgent

                // var versionFooter = this.messageStructs.parse_struct(payload.slice(80 + userAgentLength.size + userAgentLength.number), this.messageStructs.version_footer)
                // for (var attr in versionFooter) {version[attr] = versionFooter[attr]}
                // this.emit("version", version)



                // NAIVE UNPACKING
                // version.version = payload.readInt32LE(0);
                // version.services = btc.bufferutils.readUInt64LE(payload, 4);

                // // timestamps are technically signed ints but should never be negative...
                // version.timestamp = btc.bufferutils.readUInt64LE(payload, 12);
                break;
            default:
                console.log("unrecognized message: " + command.toString())
        }
    }
    done();
}
 
module.exports = {
    MessageStream: MessageStream,
    MessageEmitter: MessageEmitter
}