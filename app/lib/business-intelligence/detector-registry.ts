import type {
    BusinessIntelligenceProfile,
  } from "./types";
  
  import type {
    BusinessLeakDetector,
  } from "./detector-types";
  
  /* ================================== */
  /* DETECTOR REGISTRY */
  /* ================================== */
  
  const detectorRegistry = new Map<
    string,
    BusinessLeakDetector
  >();
  
  /* ================================== */
  /* REGISTER DETECTOR */
  /* ================================== */
  
  export function registerDetector(
    detector: BusinessLeakDetector
  ): void {
    if (!detector.id) {
      throw new Error(
        "Cannot register a detector without an ID."
      );
    }
  
    if (detectorRegistry.has(detector.id)) {
      throw new Error(
        `Detector "${detector.id}" is already registered.`
      );
    }
  
    detectorRegistry.set(
      detector.id,
      detector
    );
  }
  
  /* ================================== */
  /* GET DETECTOR */
  /* ================================== */
  
  export function getDetector(
    detectorId: string
  ): BusinessLeakDetector {
    const detector =
      detectorRegistry.get(detectorId);
  
    if (!detector) {
      throw new Error(
        `Detector "${detectorId}" is not registered.`
      );
    }
  
    return detector;
  }
  
  /* ================================== */
  /* SAFE LOOKUP */
  /* ================================== */
  
  export function findDetector(
    detectorId: string
  ): BusinessLeakDetector | null {
    return (
      detectorRegistry.get(detectorId) ??
      null
    );
  }
  
  /* ================================== */
  /* LIST ALL DETECTORS */
  /* ================================== */
  
  export function getAllDetectors():
    BusinessLeakDetector[] {
    return Array.from(
      detectorRegistry.values()
    );
  }
  
  /* ================================== */
  /* GET UNIVERSAL DETECTORS */
  /* ================================== */
  
  export function getUniversalDetectors():
    BusinessLeakDetector[] {
    return getAllDetectors().filter(
      (detector) =>
        detector.scope === "universal"
    );
  }
  
  /* ================================== */
  /* GET INDUSTRY DETECTORS */
  /* ================================== */
  
  export function getIndustryDetectors(
    profile: BusinessIntelligenceProfile
  ): BusinessLeakDetector[] {
    return getAllDetectors().filter(
      (detector) => {
        if (
          detector.scope !== "industry"
        ) {
          return false;
        }
  
        return detector.industries.includes(
          profile.industry
        );
      }
    );
  }
  
  /* ================================== */
  /* GET SUPPORTED DETECTORS */
  /* ================================== */
  
  export function getSupportedDetectors(
    profile: BusinessIntelligenceProfile
  ): BusinessLeakDetector[] {
    return getAllDetectors().filter(
      (detector) => {
        /*
          First check scope / industry.
        */
  
        const scopeSupported =
          detector.scope === "universal" ||
          detector.industries.includes(
            profile.industry
          );
  
        if (!scopeSupported) {
          return false;
        }
  
        /*
          Then allow the detector itself
          to decide whether the business
          has the required capabilities.
        */
  
        try {
          return detector.supports(
            profile
          );
        } catch {
          return false;
        }
      }
    );
  }
  
  /* ================================== */
  /* CHECK REGISTRATION */
  /* ================================== */
  
  export function hasDetector(
    detectorId: string
  ): boolean {
    return detectorRegistry.has(
      detectorId
    );
  }
  
  /* ================================== */
  /* REMOVE DETECTOR */
  /* ================================== */
  
  export function unregisterDetector(
    detectorId: string
  ): boolean {
    return detectorRegistry.delete(
      detectorId
    );
  }
  
  /* ================================== */
  /* CLEAR REGISTRY */
  /* ================================== */
  
  /*
    Primarily useful for automated tests.
  */
  
  export function clearDetectorRegistry():
    void {
    detectorRegistry.clear();
  }