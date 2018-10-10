/**
 * @file holds the code for the class Nginx
 * @link https://github.com/datarhei/restreamer
 * @copyright 2016 datarhei.org
 * @license Apache-2.0
 */
'use strict';

const Q = require('q');
const config = require('../../conf/live.json');
const proc = require('process');
const spawn = require('child_process').spawn;
const logger = require('./Logger')('Nginxrtmp');
const rp = require('request-promise');

/**
 * Class to watch and control the NGINX RTMP server process
 */
class Nginxrtmp {

    /**
     * Constructs the NGINX rtmp with injection of config to use
     * @param config
     */
    constructor(config) {
        this.config = config;
        this.logger = logger;

        this.process = null;        // Process handler
        this.allowRestart = false;  // Whether to allow restarts. Restarts are not allowed until the first successful start
    }

    /**
     * Start the NGINX server
     * @returns {Promise.<boolean>}
     */
    async start() {
        this.logger.info('Starting NGINX ...');
        let timeout = 250;
        let abort = false;

        this.process = spawn(this.config.nginx.command, this.config.nginx.args);

        this.process.stdout.on('data', (data) => {
            this.logger.info(data.toString().trim(), 'NGINX');
        });

        this.process.stderr.on('data', (data) => {
            this.logger.error(data.toString().trim(), 'NGINX');
        });

        this.process.on('close', (code) => {
            abort = true;

            this.logger.error('NGINX exited with code: ' + code);

            if(code < 0) {
                return;
            }

            if(this.allowRestart == true) {
                let self = this;
                setTimeout(() => {
                    self.logger.info('Trying to restart NGINX');
                    self.start();
                }, timeout);
            }
        });

        this.process.on('error', (err) => {
            this.logger.error('Failed to spawn NGINX process: ' + err.name + ': ' + err.message);
        });

        let running = false;

        while(running == false){
            running = await this.isRunning(timeout);
            if(abort == true) {
                break;
            }
        }

        if(running == false) {
            this.process = null;
            throw new Error('NGINX failed to start');
        }
        else {
            this.allowRestart = true;
            this.logger.info('NGINX successfully started');
        }

        return true;
    }

    /**
     * Get current state of the NGINX server
     * @returns {Promise.<boolean>}
     */
    async isRunning(delay) {
        const url = "http://" + config.nginx.streaming.ip + ":" +  config.nginx.streaming.http_port  +  config.nginx.streaming.http_health_path;

        try {
            await Q.delay(delay); // delay the state detection by the given amount of milliseconds
            const response = await rp(url);
            return (response == 'pong');
        } catch(error) {
            return false;
        }
    }
}

module.exports = (config) => {
    return new Nginxrtmp(config);
};
