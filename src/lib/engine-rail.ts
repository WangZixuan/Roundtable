// Split engines into Cloud (first-party catalog + Custom) and Local
// (no catalog — inject a model). A missing `access` is Cloud so older
// payloads stay in the top group. VibeCoder would join Local later.
import type { InstanceInfo } from "@/state/store";

export function isCustomOnly(instance: { access?: InstanceInfo["access"] } | undefined): boolean {
  return instance?.access === "custom";
}

export function availableModelInstances(instances: readonly InstanceInfo[]): InstanceInfo[] {
  return instances.filter((instance) =>
    instance.snapshot.state === "available" &&
    (isCustomOnly(instance) || instance.snapshot.authenticated !== false) &&
    instance.models.options.length > 0,
  );
}

export function splitEngineRail<T>(instances: readonly T[]): {
  subscription: T[];
  custom: T[];
} {
  const subscription: T[] = [];
  const custom: T[] = [];
  for (const instance of instances) {
    if (isCustomOnly(instance as { access?: InstanceInfo["access"] })) custom.push(instance);
    else subscription.push(instance);
  }
  return { subscription, custom };
}
