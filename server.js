const path = require('path');
const express = require('express');
const fs = require('fs')
const app = express();
let serverIp = '0.0.0.0';
const  request = require('request');
const UdpPortHandler = require("./UDPPortHandler");
const Settings = require("./Settings");
let lastUpdateDate = 0;
let canSendOSC = false;
let fileToDownload = 0;
let charges = [];
const osHomedir = require('os-homedir');
let appPath = path.join(__dirname);
const settings = new Settings()
//appPath = path.join(osHomedir(), 'charge');


/* Variables */

settings.add('serverPort', 3000);
settings.add('ipToSend', '0.0.0.0');
settings.add('receivePort', 12346);
settings.add('sendPort', 12345);
settings.add('url', 'https://icecube.wisc.edu/~mrongen/spiering_live/');
settings.add('delayForNewDataInSeconds', '10');
settings.add('delayToSendOscInSeconds', '10');
settings.add('oscAddress', '/charge');
settings.add('user', 'art');
settings.add('password', 'giraffe');

const fileUrl = path.join(appPath, 'settings.json');
settings.loadFromFile(fileUrl);
let {serverPort,ipToSend,receivePort,sendPort,url,delayForNewDataInSeconds,delayToSendOscInSeconds,oscAddress, user, password} = settings.getAll();

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
    setTimeout(getDataArray, delayForNewDataInSeconds*1000);
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
        if(!isNaN(newValue)){
            const oscData = [{
                type: 'f',
                value: newValue
            }];
            udpHandler.sendData(oscAddress, oscData);
         }
    }
    setTimeout(sendOsc, delayToSendOscInSeconds*1000);
}

const udpHandler = new UdpPortHandler(serverIp, receivePort, ipToSend, sendPort)

const server = app.listen(serverPort, serverIp, function () {
    console.log("Server started on " + serverIp + ":" + serverPort);
    console.log("Fetch the website "+url+" every "+delayForNewDataInSeconds+" seconds")
    console.log("Send OSC message to "+ipToSend+" at port "+sendPort);
    getDataArray();
    sendOsc();
});
  
app.get('/', function (req, res) {
    
});