import { useMemo } from "react";
import { useSyncSystem } from "./Powersync";
import { PowerSyncContext } from "@powersync/react-native";

export const PowersyncProvider = ({ children }: { children: React.ReactNode }) => {

  const { powersync } = useSyncSystem();

  const db = useMemo(() => {
    return powersync
  }, [powersync])
 
  return (
    <PowerSyncContext.Provider value={db}>
      {children}
    </PowerSyncContext.Provider>
  )
}