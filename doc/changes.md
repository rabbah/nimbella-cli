# Nimbella CLI Change History

## Changes in release 0.1.12

- Substantial documentation style and organization improvements
- Document clarifies that unquoted values in `project.yml` can have varyting types by YAML rules
- Where it makes sense, commands with omitted required arguments display help
- `project create` is now documented
- Streamlined syntax for multiple symbol substitution in `project.yml`
- `package delete --recursive`
- fixes to `route` commands
- fix bug that caused `project watch` to misbehave when `--env` was specified
- fixes to `trigger` commands and to `activation list` for triggers
- added `nim info --changes`
- a `targetNamespace` directive or the `--target` flag affects only the current deploy operation and does not change the current namespace for later deploys

## Changes in release 0.1.11
- Release 0.1.11 supports web deployment to the current Nimbella platform (older releases do not)
- Fixed bug in `environment` property as applied to packages
- Fix `action invoke` mis-behavior when asynchronous
- Hide `debug` flag in most help menus



