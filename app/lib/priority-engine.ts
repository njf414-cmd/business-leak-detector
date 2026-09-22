import type {
    Leak,
    LeakType,
  } from "./leak-engine";
  
  export type PriorityLevel =
    | "Critical"
    | "High"
    | "Medium";
  
  export type PrioritizedLeak =
    Leak & {
      priorityScore: number;
      priorityLevel: PriorityLevel;
    };
  
  /* ---------------------------------- */
  /* TYPE WEIGHT */
  /* ---------------------------------- */
  
  function getTypeWeight(
    type: LeakType
  ): number {
    switch (type) {
      /*
        Direct collection problems.
        These are closest to cash.
      */
  
      case "Overdue Invoice":
        return 35;
  
      case "Failed Payment":
        return 34;
  
      case "Partial Payment":
        return 32;
  
      case "Unpaid Invoice":
        return 30;
  
      /*
        Estimates / quotes.
      */
  
      case "Unfollowed Estimate":
        return 27;
  
      case "Unsent Estimate":
        return 26;
  
      case "Stale Estimate":
        return 24;
  
      case "Expired Estimate":
        return 20;
  
      /*
        Active lead opportunities.
      */
  
      case "Abandoned Lead":
        return 25;
  
      case "Unbooked Lead":
        return 21;
  
      case "Stale Lead":
        return 18;
  
      /*
        Revenue already lost.
  
        These still matter because the
        business needs to understand why
        the money escaped, but they are
        not treated as recoverable cash.
      */
  
      case "No-Show":
        return 23;
  
      case "Cancelled Job":
        return 22;
  
      case "Lost Lead":
        return 17;
  
      default:
        return 0;
    }
  }
  
  /* ---------------------------------- */
  /* SEVERITY WEIGHT */
  /* ---------------------------------- */
  
  function getSeverityWeight(
    severity: Leak["severity"]
  ): number {
    switch (severity) {
      case "High":
        return 30;
  
      case "Medium":
        return 20;
  
      case "Low":
        return 10;
  
      default:
        return 0;
    }
  }
  
  /* ---------------------------------- */
  /* DOLLAR VALUE WEIGHT */
  /* ---------------------------------- */
  
  function getAmountWeight(
    amount: number
  ): number {
    if (amount >= 5000) {
      return 30;
    }
  
    if (amount >= 2500) {
      return 25;
    }
  
    if (amount >= 1000) {
      return 20;
    }
  
    if (amount >= 500) {
      return 10;
    }
  
    return 5;
  }
  
  /* ---------------------------------- */
  /* AGE WEIGHT */
  /* ---------------------------------- */
  
  function getAgeWeight(
    daysOpen?: number
  ): number {
    if (
      daysOpen === undefined
    ) {
      return 0;
    }
  
    if (daysOpen >= 60) {
      return 25;
    }
  
    if (daysOpen >= 30) {
      return 20;
    }
  
    if (daysOpen >= 14) {
      return 15;
    }
  
    if (daysOpen >= 7) {
      return 10;
    }
  
    if (daysOpen >= 3) {
      return 5;
    }
  
    return 0;
  }
  
  /* ---------------------------------- */
  /* CATEGORY ADJUSTMENT */
  /* ---------------------------------- */
  
  function getCategoryAdjustment(
    leak: Leak
  ): number {
    /*
      Lost-revenue leaks are important
      diagnostic signals, but we don't
      want them automatically outranking
      money that can still be recovered.
  
      Recoverable leaks receive a small
      priority boost.
    */
  
    if (
      leak.category ===
      "Recoverable"
    ) {
      return 5;
    }
  
    return 0;
  }
  
  /* ---------------------------------- */
  /* PRIORITY LEVEL */
  /* ---------------------------------- */
  
  function getPriorityLevel(
    score: number
  ): PriorityLevel {
    if (score >= 70) {
      return "Critical";
    }
  
    if (score >= 50) {
      return "High";
    }
  
    return "Medium";
  }
  
  /* ---------------------------------- */
  /* PRIORITIZE LEAKS */
  /* ---------------------------------- */
  
  export function prioritizeLeaks(
    leaks: Leak[]
  ): PrioritizedLeak[] {
    return leaks
      .map((leak) => {
        const priorityScore =
          getTypeWeight(
            leak.type
          ) +
          getSeverityWeight(
            leak.severity
          ) +
          getAmountWeight(
            leak.amount
          ) +
          getAgeWeight(
            leak.daysOpen
          ) +
          getCategoryAdjustment(
            leak
          );
  
        return {
          ...leak,
  
          priorityScore,
  
          priorityLevel:
            getPriorityLevel(
              priorityScore
            ),
        };
      })
      .sort((a, b) => {
        /*
          Recoverable opportunities
          should generally appear before
          already-lost revenue when their
          scores are otherwise similar.
        */
  
        if (
          a.category !==
          b.category
        ) {
          if (
            a.category ===
              "Recoverable" &&
            b.category ===
              "Lost"
          ) {
            return -1;
          }
  
          if (
            a.category ===
              "Lost" &&
            b.category ===
              "Recoverable"
          ) {
            return 1;
          }
        }
  
        /*
          Highest priority score first.
        */
  
        if (
          b.priorityScore !==
          a.priorityScore
        ) {
          return (
            b.priorityScore -
            a.priorityScore
          );
        }
  
        /*
          If priority is tied,
          show the largest recovery
          opportunity first.
        */
  
        if (
          b.recovery !==
          a.recovery
        ) {
          return (
            b.recovery -
            a.recovery
          );
        }
  
        /*
          Final tie breaker:
          largest total amount.
        */
  
        return (
          b.amount -
          a.amount
        );
      });
  }