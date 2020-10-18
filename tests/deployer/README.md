<!--
#
# Nimbella CONFIDENTIAL
# ---------------------
#
#   2018 - present Nimbella Corp
#   All Rights Reserved.
#
# NOTICE:
#
# All information contained herein is, and remains the property of
# Nimbella Corp and its suppliers, if any.  The intellectual and technical
# concepts contained herein are proprietary to Nimbella Corp and its
# suppliers and may be covered by U.S. and Foreign Patents, patents
# in process, and are protected by trade secret or copyright law.
#
# Dissemination of this information or reproduction of this material
# is strictly forbidden unless prior written permission is obtained
# from Nimbella Corp.
#
-->

### Deployer Tests

This directory contains the source to the deployer tests.  They are run as a job in every main Jenkins sequence and can also be run locally, either in full (with a test project) or in a more limited form (using pre-defined namespaces in `nimgcp` and not requiring a test project).

#### To run the tests in full

This requires a test project to be up.  There are two cases to consider.

- case **post-deploy** is in effect if the changes to `nim` that you want to test were already present when you built the test project and before you deployed it.  The ability of the deployer to handle the normal system actions and demos has already been partly tested (else your deployment would have failed).  What remains is to confirm that the results were valid.
- case **pre-deploy** is in effect if your test project was already up before making the last changes to the `nim` you want to test.  The ability to deploy the system actions and demos remains to be tested.

##### The full test for the pre-deploy case

Do

```
nimadmin install actions
nimadmin install demos
```

Regard any failures as failures of the test and investigate before proceeding.
Assuming no failures, proceed to the `post-deploy` case.

##### The full test for the post-deploy case

1. Set the `cwd` to the directory containing this README.
2. If your test project does not have the namespace `demos test` run `./setupNamespaces`
3. Run `./runAutomated`

#### To run (some of) the tests without a test project

It is helpful to catch obvious regressions in the deployer in a more light-weight fashion without the need to bring up a test project.  This more limited test does _not_ install or examine any system actions or demos.  But, it does run all of the smaller tests that use a test namespace.  Instead of using the namespace `test` on your test project, it uses only namespaces on `nimgcp` that are reserved for tools testing.

If you do not have the namespace `wbtestni-grinjpsjnuh` in your `nim auth list`, you will need to set your project temporarily to `nimgcp` and issue

```
nimadmin user set wbtest@nimbella.com
```

If the namespace is already shown in the list, however, the process of switching to it as needed will be handled by the test automation.

Issue

```
./runAutomated --ongcp
```

to run the tests.

#### Running individual tests

The deployer tests have capitalized camel case names like `WebCache`.  To run a single test, use its script, which consists of `test<TestName>`, .e.g `testWebCache`.

#### Dealing with failures of the tests under Jenkins.

The most common failure seen under Jenkins is the failure of the `MainActions` test, due to some change in the composition of the system actions.   This test (uniquely) is located not in this directory but in [main/tests/actions](https://github.com/nimbella-corp/main/tree/master/tests/actions) which has its own README explaining how to deal with keeping the tests up to date.

Failures of other tests generally require investigation into recent changes to `nim` or (occasionally) environment changes or backend changes that affect the behavior of `nim`.
