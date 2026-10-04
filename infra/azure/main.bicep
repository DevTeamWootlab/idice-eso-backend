targetScope = 'resourceGroup'

@minLength(2)
@maxLength(58)
param appServiceName string

@minLength(5)
@maxLength(50)
param acrName string

@minLength(3)
@maxLength(63)
param postgresServerName string

@minLength(3)
@maxLength(24)
param keyVaultName string

param location string = resourceGroup().location
param databaseName string = 'idice_eso_backend'
param databaseAdminLogin string
@secure()
param databaseAdminPassword string
param githubActionsPrincipalObjectId string
param frontendUrl string
param corsOrigins string
param mailFromAddress string
@secure()
param productionSecrets object
param bootstrapImage string = 'mcr.microsoft.com/azuredocs/appservice-helloworld:latest'
param postgresSkuName string = 'Standard_D2ds_v5'
param postgresSkuTier string = 'GeneralPurpose'
param postgresStorageSizeGB int = 64
param appServiceSkuName string = 'S1'
param enablePostgresHighAvailability bool = false
// Geo-redundant backup is only supported in selected regions. Enable it after
// confirming paired-region support and the recovery objective for this service.
param enablePostgresGeoRedundantBackup bool = false

var vnetName = '${appServiceName}-vnet'
var privateDnsPostgresName = 'privatelink.postgres.database.azure.com'
var privateDnsVaultName = 'privatelink.vaultcore.azure.net'
var logWorkspaceName = '${appServiceName}-logs'
var appSettings = {
  NODE_ENV: 'production'
  PORT: '3000'
  HOST: '0.0.0.0'
  DB_HOST: '${postgresServerName}.postgres.database.azure.com'
  DB_PORT: '5432'
  DB_USERNAME: '${databaseAdminLogin}@${postgresServerName}'
  DB_PASSWORD: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=DB-PASSWORD)'
  DB_SSL_REJECT_UNAUTHORIZED: 'true'
  FRONTEND_URL: frontendUrl
  CORS_ORIGINS: corsOrigins
  MAIL_PROVIDER: 'resend'
  MAIL_API_KEY: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=MAIL-API-KEY)'
  MAIL_FROM_ADDRESS: mailFromAddress
  SMS_PROVIDER: 'termii'
  SMS_API_KEY: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=SMS-API-KEY)'
  SMS_SENDER_ID: 'iDICE'
  JWT_ACCESS_SECRET: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=JWT-ACCESS-SECRET)'
  JWT_ACCESS_EXPIRES_IN: '15m'
  JWT_REFRESH_SECRET: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=JWT-REFRESH-SECRET)'
  JWT_REFRESH_EXPIRES_IN: '7d'
  MFA_ENCRYPTION_KEY: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=MFA-ENCRYPTION-KEY)'
  MFA_ISSUER: 'iDICE ESO Portal'
  APP_VERSION: 'bootstrap'
  NIN_HASH_KEY: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=NIN-HASH-KEY)'
  NIN_ENCRYPTION_KEY: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=NIN-ENCRYPTION-KEY)'
  SYSADMIN_SEED_EMAIL: 'admin@idice.eso.wootlab.ng'
  SYSADMIN_SEED_PASSWORD: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=SYSADMIN-SEED-PASSWORD)'
  WEBSITES_PORT: '3000'
  WEBSITE_HEALTHCHECK_MAXPINGFAILURES: '3'
  WEBSITE_SWAP_WARMUP_PING_PATH: '/api/v1/health/ready'
  WEBSITE_SWAP_WARMUP_PING_STATUSES: '200'
  WEBSITE_VNET_ROUTE_ALL: '1'
  RUN_MIGRATIONS: 'false'
  DB_SSL: 'true'
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.30.0.0/16']
    }
    subnets: [
      {
        name: 'appservice-integration'
        properties: {
          addressPrefix: '10.30.1.0/24'
          delegations: [
            {
              name: 'appservice'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: 'postgres-flexible'
        properties: {
          addressPrefix: '10.30.2.0/24'
          delegations: [
            {
              name: 'postgres-flexible'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
      {
        name: 'private-endpoints'
        properties: {
          addressPrefix: '10.30.3.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource postgresDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: privateDnsPostgresName
  location: 'global'
}

resource postgresDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: postgresDns
  name: '${vnetName}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

resource vaultDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: privateDnsVaultName
  location: 'global'
}

resource vaultDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: vaultDns
  name: '${vnetName}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01' = {
  name: postgresServerName
  location: location
  sku: {
    name: postgresSkuName
    tier: postgresSkuTier
  }
  properties: {
    version: '16'
    administratorLogin: databaseAdminLogin
    administratorLoginPassword: databaseAdminPassword
    storage: {
      storageSizeGB: postgresStorageSizeGB
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 35
      geoRedundantBackup: enablePostgresGeoRedundantBackup ? 'Enabled' : 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'postgres-flexible')
      privateDnsZoneArmResourceId: postgresDns.id
      publicNetworkAccess: 'Disabled'
    }
    highAvailability: enablePostgresHighAvailability
      ? {
          mode: 'ZoneRedundant'
          standbyAvailabilityZone: '2'
        }
      : { mode: 'Disabled' }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
  }
  dependsOn: [postgresDnsLink]
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01' = {
  parent: postgres
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      bypass: 'None'
      defaultAction: 'Deny'
      ipRules: []
      virtualNetworkRules: []
    }
  }
}

resource vaultSecrets 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = [for secretName in objectKeys(productionSecrets): {
  parent: vault
  name: secretName
  properties: {
    value: productionSecrets[secretName]
  }
}]

resource vaultPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${keyVaultName}-pe'
  location: location
  properties: {
    subnet: {
      id: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'private-endpoints')
    }
    privateLinkServiceConnections: [
      {
        name: '${keyVaultName}-connection'
        properties: {
          privateLinkServiceId: vault.id
          groupIds: ['vault']
        }
      }
    ]
  }
}

resource vaultPrivateDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: vaultPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'vault-zone'
        properties: {
          privateDnsZoneId: vaultDns.id
        }
      }
    ]
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: { name: 'Standard' }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appServiceName}-plan'
  location: location
  kind: 'linux'
  sku: {
    name: appServiceSkuName
    tier: 'Standard'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logWorkspaceName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource autoscale 'Microsoft.Insights/autoscaleSettings@2022-10-01' = {
  name: '${appServiceName}-autoscale'
  location: location
  properties: {
    enabled: true
    targetResourceUri: plan.id
    profiles: [
      {
        name: 'cpu-based-scale'
        capacity: {
          minimum: '1'
          maximum: '3'
          default: '1'
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: plan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 70
              dividePerInstance: false
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: plan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT20M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: 30
              dividePerInstance: false
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT10M'
            }
          }
        ]
      }
    ]
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  kind: 'app,linux,container'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    virtualNetworkSubnetId: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'appservice-integration')
    siteConfig: {
      alwaysOn: true
      acrUseManagedIdentityCreds: true
      linuxFxVersion: 'DOCKER|${bootstrapImage}'
      healthCheckPath: '/api/v1/health/ready'
      http20Enabled: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      vnetRouteAllEnabled: true
    }
  }
}

resource stagingSlot 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: webApp
  name: 'staging'
  location: location
  kind: 'app,linux,container'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    virtualNetworkSubnetId: resourceId('Microsoft.Network/virtualNetworks/subnets', vnetName, 'appservice-integration')
    siteConfig: {
      alwaysOn: true
      acrUseManagedIdentityCreds: true
      linuxFxVersion: 'DOCKER|${bootstrapImage}'
      healthCheckPath: '/api/v1/health/ready'
      http20Enabled: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      vnetRouteAllEnabled: true
    }
  }
}

resource appSettingsResource 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webApp
  name: 'appsettings'
  properties: appSettings
}

resource stagingAppSettings 'Microsoft.Web/sites/slots/config@2023-12-01' = {
  parent: stagingSlot
  name: 'appsettings'
  properties: union(appSettings, { RUN_MIGRATIONS: 'true' })
}

resource slotSettingNames 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webApp
  name: 'slotConfigNames'
  properties: {
    appSettingNames: ['RUN_MIGRATIONS']
  }
}

resource webAppVaultSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, webApp.id, 'KeyVaultSecretsUser')
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource stagingVaultSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, stagingSlot.id, 'KeyVaultSecretsUser')
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: stagingSlot.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource webAppAcrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, webApp.id, 'AcrPull')
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource stagingAcrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, stagingSlot.id, 'AcrPull')
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: stagingSlot.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource appDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'send-to-${logWorkspaceName}'
  scope: webApp
  properties: {
    workspaceId: logWorkspace.id
    logs: [
      { categoryGroup: 'allLogs', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

resource postgresDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'send-to-${logWorkspaceName}'
  scope: postgres
  properties: {
    workspaceId: logWorkspace.id
    logs: [
      { categoryGroup: 'allLogs', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

resource vaultDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'send-to-${logWorkspaceName}'
  scope: vault
  properties: {
    workspaceId: logWorkspace.id
    logs: [
      { categoryGroup: 'audit', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

resource githubAcrPushRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, githubActionsPrincipalObjectId, 'AcrPush')
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '8311e382-0749-4cb8-b61a-304f252e45ec')
    principalId: githubActionsPrincipalObjectId
    principalType: 'ServicePrincipal'
  }
}

output apiHostName string = webApp.properties.defaultHostName
output acrLoginServer string = registry.properties.loginServer
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
output keyVaultName string = vault.name
output appServiceName string = webApp.name
output resourceGroupName string = resourceGroup().name
output logAnalyticsWorkspaceName string = logWorkspace.name
