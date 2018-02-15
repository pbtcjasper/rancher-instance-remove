const urlJoin = require('url-join')
const rp = require('request-promise')
const log = require('../lib/log')
const util = require('util')

const hostsPath = '/hosts'
const deactivatePath = '/?action=deactivate'
const removePath = '/?action=remove'

function RancherHelper (rancherConfig, accessKeyId, secretAccessKey) {
    this.config = {
      url: rancherConfig.baseUrl,
      path: rancherConfig.path,
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey
    }
}

RancherHelper.prototype.getDisconnectedHosts = function() {
  const options = this.createRequestOptions(hostsPath)
  log.debug(`Getting hosts via: ${options.uri}`)
  return rp(options)
    // .then(response => parseResponse(response))
    .then(info => determineDetached(info))

}

RancherHelper.prototype.detachInstances = function(dnsNames) {
  log.debug(`Removing ${dnsNames.length} hosts`)
  const promises = dnsNames.map(dnsName => this.deactivateAndRemoveInstance(dnsName))
  if (promises && promises.length > 0){
    return Promise.all(promises)
  } else {
    return Promise.resolve()
  }
}

RancherHelper.prototype.deactivateAndRemoveInstance = function (dnsName) {
  const options = this.createRequestOptions(hostsPath)
  log.debug(`Calling hosts: ${options.uri}`)
  return rp(options)
    .then(info => this.deactivateInstance(info, dnsName))
}

RancherHelper.prototype.deactivateInstance = function (info, dnsName) {
  log.silly(`Received for instance ${dnsName}: ${util.inspect(info)}`)
  if (info && info.data && info.data.length > 0) {
    info.data.forEach(host => {
      log.silly(`Host info: ${util.inspect(host)}`)
      if (host.hostname === dnsName) {
        const options = this.createRequestOptions(deactivatePath, 'post', host.links.self)
        let deactivatePr = null
        if (host.state === 'inactive' ) {
          deactivatePr = Promise.resolve(host)
        } else {
          //host is deactivated
          log.debug(`Deactivating through: ${options.uri}`)
          deactivatePr = rp(options)
         }
        return deactivatePr.then(inactiveHost => this.removeInstance(inactiveHost, dnsName))
      }
    })
  }
  log.info(`No instances found for: ${dnsName}`)
  // we do not need to raise an error if the instance is not found
  return Promise.resolve()
}

RancherHelper.prototype.removeInstance = function (info, dnsName) {
  log.debug(`Removing ${dnsName}`)
  log.debug(`Info: ${info}`)
  const selfOptions =  this.createRequestOptions('', 'get', info.links.self)
  return rp(selfOptions)
    .then(info => waitForInactiveState(selfOptions, info, 0))
    .then(inactiveInfo => {
      if (inactiveInfo.state === 'inactive') {
        const removeOptions = this.createRequestOptions(removePath, 'post', inactiveInfo.links.self)
        return rp(removeOptions)
      } else {
        log.info(`Instance ${dnsName} does not have the desired state: inactive`)
        return Promise.resolve()
      }
    })
}

RancherHelper.prototype.createRequestOptions = function (path, method='get', baseUrl=null) {
  let rancherUrl = urlJoin(this.config.url, this.config.path)
  if (baseUrl) {
    rancherUrl = baseUrl
  }
  log.debug(`Adding ${path} to ${rancherUrl}`)
  return {
    uri: urlJoin(rancherUrl, path),
    auth: {
      user: this.config.accessKeyId,
      pass: this.config.secretAccessKey,
    },
    method: method,
    json: true
  }
}

function waitForInactiveState (options, info, count=0) {
  const newCount = count + 1
  log.debug(`Counting ${newCount}`)
  if (newCount < 60 && info.state != 'inactive' ) {
    const delayPr = (time) => (result) => new Promise(resolve => setTimeout(() => resolve(result), time))
    return delayPr(1000)
      .then(rp(options))
      .then(newResp => waitForInactiveState(options, newResp, newCount))
  }
  log.debug('Finished waiting')
  return Promise.resolve(info)
}

function determineDetached(info) {
  const detached = info.data.filter(host => host.state === 'disconnected' || host.state === 'inactive')
  log.debug(`Found ${detached.length} detached instances`)
  return Promise.resolve(detached)
}

// function parseResponse(response) {
//   return new Promise((resolve, reject) => {
//     try {
//       log.debug(`Parsing ${response}`)
//
//       log.debug(`Data: ${util.inspect(response)}`)
//       const info = JSON.parse(response)
//       resolve(info)
//     } catch (err) {
//       reject(err)
//     }
//   })
// }

module.exports = RancherHelper