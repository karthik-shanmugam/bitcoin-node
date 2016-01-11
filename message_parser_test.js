var message_parser = require('./message_parser')
var bitcoin = require('bitcoinjs-lib');

message_emitter = message_parser.MessageEmitter()
message_stream = message_parser.MessageStream()
message_stream.pipe(message_emitter)
message_emitter.on("version", function(version) {
    console.log("version:", version)
    console.log(version.header.addr_recv.services)
})
var sample_version = new Buffer("f9beb4d976657273696f6e000000000064000000358d493262ea0000010000000000000011b2d05000000000010000000000000000000000000000000000ffff000000000000000000000000000000000000000000000000ffff0000000000003b2eb35d8ce617650f2f5361746f7368693a302e372e322fc03e0300", "hex")
var sample_verack = new Buffer("F9BEB4D976657261636B000000000000000000005DF6E0E2", "hex")

var sample_addr = new Buffer("F9BEB4D96164647200000000000000001F000000ED52399B01E215104D010000000000000000000000000000000000FFFF0A000001208D", "hex")
var sample_messages = Buffer.concat([sample_version, sample_verack, sample_addr])
var slice_len = 44
for (var i = 0; i + slice_len <= sample_messages.length; i += slice_len) {
    message_stream.write(sample_messages.slice(i, i + slice_len))
}
message_stream.write(sample_messages.slice(i))

// message_stream.on("data", function(data) {
//     console.log(data)
//     console.log(data.checksum)
//     console.log(bitcoin.crypto.hash256(data.payload).slice(0, 4))
// })
// version = message_stream.read()
// console.log(version)
// console.log(version.checksum)
// console.log(bitcoin.crypto.hash256(version.payload).slice(0, 4))

// verack = message_stream.read()
// console.log(verack)
// console.log(verack.checksum)
// console.log(bitcoin.crypto.hash256(verack.payload).slice(0, 4))

// addr = message_stream.read()
// console.log(addr)
// console.log(addr.checksum)
// console.log(bitcoin.crypto.hash256(addr.payload).slice(0, 4))