import { useEffect } from "react";
import { bootstrapNative } from "@/lib/native";

export function NativeBoot() {
  useEffect(() => {
    void bootstrapNative();
  }, []);
  return null;
}
