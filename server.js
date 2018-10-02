const path = require('path');
const express = require('express');
const fs = require('fs')
const app = express();
let serverIp = '0.0.0.0';
const osc = require("osc");
let udpPort;
let udpReady = false;
const  request = require('request');
const minute = 1000*60;
let lastUpdateDate = 0;
let canSendOSC = false;
let fileToDownload = 0;
let charges = [];
const osHomedir = require('os-homedir');
let appPath = path.join(osHomedir(), 'charge');


/* Variables */

let serverPort = 3000;
let receivePort = 12346;
let sendPort = 12345;
let url = 'https://icecube.wisc.edu/~mrongen/spiering_live/';
let user = 'art';
let password = 'giraffe';
let delayForNewData = 5*minute;
let delayToSendOsc = parseFloat(minute/60);
let oscAddress = "/charge";

function readSettings(fileName){
    const fileUrl = path.join(appPath, fileName);
    const contents = fs.readFileSync(fileUrl);
    settings = JSON.parse(contents);
    serverPort      = settings.serverPort;
    ipToSend        = settings.ipToSend;
    receivePort     = settings.receivePort;
    sendPort        = settings.sendPort;
    if(settings.url)
        url             = settings.url;
    delayForNewData = settings.delayForNewDataInSeconds*1000;
    if(settings.user)
        user            = settings.user;
    if(settings.password)
        password        = settings.password;
    if(settings.oscAddress)
        oscAddress        = settings.oscAddress;
    delayToSendOsc  = settings.delayToSendOscInSeconds*1000;
}

function getDataArray(){
    const time = Date(Date.now()).toString();
    console.log(time +" - Check new data");
    const urlWithPassword = 'https://'+user+':'+password+'@icecube.wisc.edu/~mrongen/spiering_live';
    request(urlWithPassword, function (error, response, body) {
        const status = response && response.statusCode;
        if(!error && status == 200){     
            onGetDataFromUrl(body); 
        } 
    })
}

function onGetDataFromUrl(body){
    const updateDate = getUpdateDate(body);
    const time = Date(Date.now()).toString();
    if(updateDate != lastUpdateDate && getTotLink(body) > 1){
        console.log("----" +time +" - New data loaded");
        const folderName = updateDate.replace(' ','--').replace(':','-');
        createNewFolder(folderName);
        const fileUrls = getFilesUrl(body);
        saveFiles(fileUrls, folderName);
        lastUpdateDate = updateDate;
    }
    else{
        // console.log(time +" - No new data");
    }
    setTimeout(getDataArray, delayForNewData);
}

function getTotLink(body){
    const indexOfFirstAlign = body.indexOf('align="right">')+24;
    let textToCheck = body.substring(indexOfFirstAlign);
    return (textToCheck.match(/href=/g) || []).length;
}

function getFilesUrl(body){
    const indexOfFirstAlign = body.indexOf('align="right">')+24;
    let textToCheck = body.substring(indexOfFirstAlign);
    const count = getTotLink(body);
    let urls = [];
    if(count > 0){
        for(let a = 0; a < count; a++){
            const indexOfFirstHref = textToCheck.indexOf('href');
            let newBody = textToCheck.substring(indexOfFirstHref, 1000);
            const indexOfFirstEndUrl = newBody.indexOf('.txt">');
            newBody = newBody.substring(6, indexOfFirstEndUrl+4);
            const fileUrl = newBody;
            urls.push(fileUrl)
            textToCheck = textToCheck.substring(indexOfFirstHref+50);
        }
    }
    return urls;
}

function saveFiles(fileUrls, folderName){
    fileToDownload = fileUrls.length;
    canSendOSC = false;
    charges = [];
    [...fileUrls].forEach((url) => {
        const urlWithPassword = 'https://'+user+':'+password+'@icecube.wisc.edu/~mrongen/spiering_live/'+url;
        request(urlWithPassword, function (error, response, body) {
            const status = response && response.statusCode;
            fileToDownload--;
            if(!error && status == 200){     
                const fileToSaveName =  path.join(appPath,'data', folderName,url);
                fs.writeFile(fileToSaveName, body, function(err) {
                    if(err) {
                        return console.log(err);
                    }

                    const chargeArray = body.split('\n').map(profile => {
                        const p = profile.split('\t');
                        return p[3];
                    });
                    charges = [...charges, ...chargeArray];
                    if(fileToDownload == 0){
                        canSendOSC = true;
                    }
                }); 
            } 
        })
    });
}

function createNewFolder(folderName){
    const dir = path.join(appPath,'data', folderName);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
}

function getNowDate(){
    let today = new Date();
    let dd = today.getDate();
    let mm = today.getMonth()+1; //January is 0!
    const yyyy = today.getFullYear();
    if(dd<10){
        dd='0'+dd;
    } 
    if(mm<10){
        mm='0'+mm;
    } 
    return yyyy+'-'+mm+'-'+dd;
}

function getUpdateDate(body){
    const indexOfFirstAlign = body.indexOf('align="right">')+14;
    const textToCheck = body.substring(indexOfFirstAlign);
    const indexOfFirstDate = textToCheck.indexOf('align="right">')+14;
    const date =  textToCheck.substring(indexOfFirstDate, indexOfFirstDate + 16);
    return date;
}


function sendOsc(){
    if(canSendOSC&&charges.length>0){
        const newValue = charges.shift();
        if(udpReady&&!isNaN(newValue)){
            udpPort.send({
                address: oscAddress,
                args: [{
                    type: 'f',
                    value: newValue
                }]
            }, ipToSend, sendPort);
         }
    }
    setTimeout(sendOsc, delayToSendOsc);
}


readSettings('settings.json');

udpPort = new osc.UDPPort({
    localAddress: serverIp,
    localPort: receivePort
});

const server = app.listen(serverPort, serverIp, function () {
    console.log("Server started on " + serverIp + ":" + serverPort);
    console.log("Fetch the website "+url+" every "+parseFloat(delayForNewData/1000,2)+" seconds")
    console.log("Send OSC message to "+ipToSend+" at port "+sendPort);
    getDataArray();
    sendOsc();
});
  
app.get('/', function (req, res) {
    
});

udpPort.on("error", function (error) {
    console.log("An error occurred: ", error.message);
});

udpPort.on("ready", function () {
    udpReady = true;
});

udpPort.open();

