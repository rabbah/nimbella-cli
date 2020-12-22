const { getCredentialsFromEnvironment } = require('nimbella-deployer')

exports.main = (args) => {
    return getCredentialsFromEnvironment()
}
