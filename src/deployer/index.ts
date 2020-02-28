/*
 * Nimbella CONFIDENTIAL
 * ---------------------
 *
 *   2018 - present Nimbella Corp
 *   All Rights Reserved.
 *
 * NOTICE:
 *
 * All information contained herein is, and remains the property of
 * Nimbella Corp and its suppliers, if any.  The intellectual and technical
 * concepts contained herein are proprietary to Nimbella Corp and its
 * suppliers and may be covered by U.S. and Foreign Patents, patents
 * in process, and are protected by trade secret or copyright law.
 *
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Nimbella Corp.
 */

 // Gather together the major deployer exports for convenient import in other packages

export { deployProject, readPrepareAndBuild, readAndPrepare, deploy, readProject, buildProject, prepareToDeploy,
    wipeNamespace, wipePackage } from './api'
export { DeployStructure, DeployResponse, DeploySuccess, OWOptions, Credentials, CredentialRow, Flags, PackageSpec, ActionSpec,
    CredentialHostMap, CredentialNSMap, DeployerAnnotation, VersionMap } from './deploy-struct'
export { doLogin, doAdminLogin, addCredentialAndSave, getCredentials, getCredentialList, getCredentialsForNamespace, forgetNamespace, switchNamespace,
    Persister, fileSystemPersister, browserPersister } from './login'
export { computeBucketStorageName, computeBucketDomainName, cleanBucket } from './deploy-to-bucket'
export { extFromRuntime } from './util'
export { GithubDef, isGithubRef, parseGithubRef, fetchProject } from './github'
