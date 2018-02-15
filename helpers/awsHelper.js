const AWS = require('aws-sdk')
const log = require('../lib/log')

function AwsHelper (accessKeyId, secretAccessKey, region) {
  this.autoscaling = new AWS.AutoScaling({
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
    region: region
  })
  this.ec2 = new AWS.EC2({
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
    region: region
  })
}

AwsHelper.prototype.getDetachingInstances = function () {
  return new Promise((resolve, reject) => {
    this.autoscaling.describeAutoScalingInstances({}, function(err, data) {
      if (err) {
        reject(err)
      }
      else {
        const instances = data.AutoScalingInstances
        const toRemove = instances.filter(instance => instance.LifecycleState === 'Detaching')
        resolve(toRemove.map(instance => instance.PrivateDnsName))
      }
    })
  })
}

AwsHelper.prototype.determinedTerminatedHosts = function(hosts) {
  return new Promise((resolve, reject) => {
    let toRemove = hosts
    const dnsNames = hosts.map(host => host.hostname)
    log.debug(`Searching EC2 instances by private dns name: ${dnsNames}`)
    this.ec2.describeInstances({
      Filters: [
        {
          Name: 'private-dns-name',
          Values: dnsNames
        }
      ]
    }, function(err, data) {
      if (err) {
        reject(err)
        return
      }
      const reservations = data.Reservations
      if (reservations && reservations.length > 0 ) {
        reservations.forEach(reservation => {
          const instances = reservation.Instances
          const running = instances.filter(instance => instance.State.Name === 'pending' || instance.State.Name === 'running' )
          const runningDnsNames = running.map(instance => instance.PrivateDnsName)
          log.debug(`Running instances: ${runningDnsNames}`)
          toRemove = toRemove.filter(x => runningDnsNames.indexOf(x.hostname) < 0)
        })
        const toRemoveDnsNames = toRemove.map( host => host.hostname)
        log.info(`To remove: ${toRemoveDnsNames}`)
        resolve(toRemoveDnsNames)
      } else {
        log.info('No instances found, removing all disconnected hosts')
        resolve(dnsNames)
      }
    })
  })
}

module.exports = AwsHelper


