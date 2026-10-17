import { createSolarBrowserClient } from "./supabase-client";
import { SolarTask } from "@/types/solar-types";

export async function createBrowserTask(task: Omit<SolarTask, "id">) {
  const supabase = createSolarBrowserClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert([task])
    .select()
    .single();

  if (error) throw error;
  return data as SolarTask;
}

