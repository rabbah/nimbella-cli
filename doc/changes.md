# Nimbella CLI Change History

## Changes since release 0.1.12

- web content is now deployed with cache-control set to 'no-cache' for less surprising behavior during development
    - in the future we will provide a way to turn on cacheing for content in production
- remove `nim project github` and add `nim auth github` instead
    - this eliminates the "alias" concept for github locations but substitutes convenient management of github credentials
    - also change how github locations are specified on deploy
    - deploy from github is still considered experimental and not yet documented
- improve error handling for illegal flags
- improve error message when no current namespace
- support 'web' property of package in `project.yml`, distributes over all actions in the package
- new commands to list contents of object store, web bucket, and key-value store
    - still under development and not yet documented
- use less concurrency in running action builds to avoid blowing file handle limits

## Changes in release 0.1.12

- Substantial documentation style and organization improvements
- Document clarifies that unquoted values in `project.yml` can have varying types by YAML rules
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



