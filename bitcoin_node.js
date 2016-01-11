var net = require('net');
var bitcoin = require('bitcoinjs-lib');
var message_parser = require('./message_parser')
console.log("hello world");
var verack;
var sample_version_message = new Buffer("f9beb4d976657273696f6e000000000064000000358d493262ea0000010000000000000011b2d05000000000010000000000000000000000000000000000ffff000000000000000000000000000000000000000000000000ffff0000000000003b2eb35d8ce617650f2f5361746f7368693a302e372e322fc03e0300", "hex");

var client = new net.Socket();
HOST = "52.28.168.11";
PORT = 8333;
client.connect(PORT, HOST, function() {

    console.log('CONNECTED TO: ' + HOST + ':' + PORT);
    // Write a message to the socket as soon as the client is connected, the server will receive it as message from the client 
    client.write(sample_version_message);

});
message_stream = message_parser.MessageStream()
message_emmiter = message_parser.MessageEmitter()
// message_stream.on("data", function(data) {
//     var command = data.command.indexOf(0) == -1 ? data.command : data.command.slice(0, data.command.indexOf(0))
//     console.log("Received command: " + command.toString())
//     console.log("Expected   checksum: " + data.checksum.toString("hex"))
//     console.log("Calculated checksum: " + bitcoin.crypto.hash256(data.payload).slice(0, 4).toString("hex"))
//     console.log()
// })
client.pipe(message_stream).pipe(message_emmiter)
message_emmiter.on("message", function(msg) {
    var command = msg.command.indexOf(0) == -1 ? msg.command : msg.command.slice(0, msg.command.indexOf(0))
    console.log("Received command: " + command.toString())
    console.log("Expected   checksum: " + msg.checksum.toString("hex"))
    console.log("Calculated checksum: " + bitcoin.crypto.hash256(msg.payload).slice(0, 4).toString("hex"))
    console.log()
})
message_emmiter.on("version", function(version) {
    console.log(version)
    console.log(version.addr_from)
    console.log(version.addr_from.time)
    console.log(version.addr_from.services)
    console.log(version.addr_from.ip_addr)
    console.log(version.addr_from.port)
})
// // Add a 'data' event handler for the client socket
// // data is what the server sent to this socket
// client.on('data', function(data) {
    
//     console.log('DATA: ' + data);
//     verack = data;
//     // Close the client socket completely
//     //client.destroy();
    
// });

// Add a 'close' event handler for the client socket
client.on('close', function() {
    console.log('Connection closed');
});