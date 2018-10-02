const osc = require("osc");

module.exports = class udpPortHandler{
    constructor(localAddress, localPort, addressToSend, portToSend){
        this.udpPort;
        this.udpReady = false;
        this.localAddress = localAddress;
        this.localPort = localPort;
        this.addressToSend = addressToSend;
        this.portToSend = portToSend;
        this.setupPort(localAddress, localPort);
        this.addUdpEvents();
        this.udpPort.open();
    }

    sendData(address, data, _ip, _port){
        const ip = _ip ? _ip : this.addressToSend;
        const port = _port ? _port : this.portToSend;
        if(this.udpReady){
            this.udpPort.send({
                address: address,
                args: data
            }, ip, port);
         }
    }

    addUdpEvents(){
        this.udpPort.on("error", this.onError.bind(this));
        this.udpPort.on("ready", this.onReady.bind(this));
    }

    onError(error){
        console.log("An error occurred: ", error.message);
    }
    
    onReady(){
        this.udpReady = true;
    }

    setupPort(localAddress, localPort){
        this.udpPort = new osc.UDPPort({
            localAddress: localAddress,
            localPort: localPort
        });
    }
};
