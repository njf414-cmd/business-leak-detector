import type {
    IntegrationConnector,
    IntegrationProvider,
  } from "./types";
  
  /* ================================== */
  /* CONNECTOR REGISTRY */
  /* ================================== */
  
  /*
    Every real integration connector gets registered here.
  
    Examples later:
  
    registerIntegrationConnector(squareConnector);
    registerIntegrationConnector(quickBooksConnector);
    registerIntegrationConnector(hubSpotConnector);
  
    The rest of the Leak Detector can then request a connector
    by provider without importing provider-specific code.
  */
  
  const connectorRegistry = new Map<
    IntegrationProvider,
    IntegrationConnector
  >();
  
  /* ================================== */
  /* REGISTER */
  /* ================================== */
  
  export function registerIntegrationConnector(
    connector: IntegrationConnector
  ): void {
    if (!connector?.provider) {
      throw new Error(
        "Cannot register an integration connector without a provider."
      );
    }
  
    if (connectorRegistry.has(connector.provider)) {
      throw new Error(
        `Integration connector "${connector.provider}" is already registered.`
      );
    }
  
    connectorRegistry.set(
      connector.provider,
      connector
    );
  }
  
  /* ================================== */
  /* GET CONNECTOR */
  /* ================================== */
  
  export function getIntegrationConnector(
    provider: IntegrationProvider
  ): IntegrationConnector {
    const connector = connectorRegistry.get(provider);
  
    if (!connector) {
      throw new Error(
        `No integration connector is registered for "${provider}".`
      );
    }
  
    return connector;
  }
  
  /* ================================== */
  /* SAFE LOOKUP */
  /* ================================== */
  
  export function findIntegrationConnector(
    provider: IntegrationProvider
  ): IntegrationConnector | null {
    return connectorRegistry.get(provider) ?? null;
  }
  
  /* ================================== */
  /* CHECK SUPPORT */
  /* ================================== */
  
  export function hasIntegrationConnector(
    provider: IntegrationProvider
  ): boolean {
    return connectorRegistry.has(provider);
  }
  
  /* ================================== */
  /* LIST REGISTERED PROVIDERS */
  /* ================================== */
  
  export function getRegisteredIntegrationProviders():
    IntegrationProvider[] {
    return Array.from(connectorRegistry.keys());
  }
  
  /* ================================== */
  /* REMOVE */
  /* ================================== */
  
  /*
    Mainly useful during testing or if connectors are loaded
    dynamically in the future.
  */
  
  export function unregisterIntegrationConnector(
    provider: IntegrationProvider
  ): boolean {
    return connectorRegistry.delete(provider);
  }
  
  /* ================================== */
  /* CLEAR */
  /* ================================== */
  
  /*
    Intended primarily for automated tests.
  */
  
  export function clearIntegrationConnectorRegistry(): void {
    connectorRegistry.clear();
  }