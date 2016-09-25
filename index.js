var request = require("request");
var Service, Characteristic, types, hapLegacyTypes, VolumeCharacteristic;

var inherits = require('util').inherits;
var debug = require('debug')('MusicCast');
var mdns = require('mdns');
var edge = require('edge');

//workaround for raspberry pi
var sequence = [
    mdns.rst.DNSServiceResolve(),
    'DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo({ families: [4] }),
    mdns.rst.makeAddressesUnique()
];

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    types = homebridge.hapLegacyTypes;

    homebridge.registerAccessory("homebridge-musiccast", "MusicCast", MusicCastAccessory);
    homebridge.registerPlatform("homebridge-musiccast", "MusicCast", MusicCastPlatform);
}

// Necessary because Accessory is defined after we have defined all of our classes
function fixInheritance(subclass, superclass) {
    var proto = subclass.prototype;
    inherits(subclass, superclass);
    subclass.prototype.parent = superclass.prototype;
    for (var mn in proto) {
        subclass.prototype[mn] = proto[mn];
    }
}

function MusicCastPlatform(log, config) {
    this.log = log;
    this.config = config;
    this.playVolume = config["play_volume"];
    this.minVolume = config["min_volume"] || -50.0;
    this.maxVolume = config["max_volume"] || -20.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.setMainInputTo = config["setMainInputTo"];
    this.expectedDevices = config["expected_devices"] || 100;
    this.discoveryTimeout = config["discovery_timeout"] || 30;
    this.manualAddresses = config["manual_addresses"] || {};
    this.browser = mdns.createBrowser(mdns.tcp('http'), { resolverSequence: sequence });
}

MusicCastPlatform.prototype = {
    accessories: function(callback) {
        this.log("Getting Yamaha AVR devices.");
        var that = this;


        var hello = edge.func(function() {
            /*
                async (input) =>{ return "dotent core"; };

            */
        });
        hello("ss", function(error, result) {
            if (error) throw error;
            that.log(result);
        });


        var browser = this.browser;
        browser.stop();
        browser.removeAllListeners('serviceUp'); // cleanup listeners
        var accessories = [];
        var timer, timeElapsed = 0,
            checkCyclePeriod = 5000;

        for (var key in this.manualAddresses) {
            // if (!this.manualAddresses.hasOwnProperty(key)) continue;
            // setupFromService({
            //     name: key,
            //     host: this.manualAddresses[key],
            //     port: 80
            // });
        }
        // Hmm... seems we need to prevent double-listing via manual and Bonjour...
        var sysIds = {};

        var accessory = new MusicCastAccessory(this.log, this.config);
        accessories.push(accessory);
        callback(accessories);
    }
}

function MusicCastAccessory(log, config) {
    this.log = log;
    this.config = config;
    this.name = "Speakers";
    this.speakerName = config["speaker_name"] || this.name; // fallback to "name" if you didn't specify an exact "bulb_name"
    this.binaryState = 0; // bulb state, default is OFF


    this.serviceName = this.name + this.nameSuffix;
    this.setMainInputTo = config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = config["min_volume"] || -50.0;
    this.maxVolume = config["max_volume"] || -20.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.log("Starting the MulticastService '" + this.speakerName + "'...");
}

MusicCastAccessory.prototype.getPowerOn = function(callback) {
    var powerOn = this.binaryState > 0;
    this.log("Power state for the '%s' is %s", this.speakerName, this.binaryState);
    callback(null, powerOn);
}

MusicCastAccessory.prototype.setPowerOn = function(powerOn, callback) {
    this.binaryState = powerOn ? 1 : 0;
    this.log("Set power state on the '%s' to %s", this.speakerName, this.binaryState);
    callback(null);
}

MusicCastAccessory.prototype.getServices = function() {
    var that = this;
    var informationService = new Service.AccessoryInformation();
    informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, "Yamaha")
        .setCharacteristic(Characteristic.Model, "1600")
        .setCharacteristic(Characteristic.SerialNumber, "tbd");


    var switchService = new Service.Switch("Power State");
    switchService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerOn.bind(this))
        .on('set', this.setPowerOn.bind(this));


    return [informationService, switchService];
}