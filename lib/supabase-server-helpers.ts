import { cache } from "react";
import { createSolarServerClient } from "./supabase-server";
import { SolarTask, SolarActivity, SolarRepo, SolarUser } from "@/types/solar-types";

export const fetchServerSolarUser = cache(async (): Promise<SolarUser | null> => {
  try {
    const supabase = await createSolarServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const userMetadata = user.user_metadata || {};
    return {
      id: user.id,
      email: user.email,
      name: userMetadata.full_name || userMetadata.name || userMetadata.user_name || "Alex Chen",
      avatarUrl: userMetadata.avatar_url,
      githubUsername: userMetadata.user_name || userMetadata.preferred_username || "sundaram2021",
    };
  } catch (err) {
    console.warn("Could not fetch server user:", err);
    return null;
  }
});

export const fetchServerTasks = cache(async (): Promise<SolarTask[]> => {
  try {
    const supabase = await createSolarServerClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("id,title,status,kind,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];
    return data as unknown as SolarTask[];
  } catch (err) {
    console.warn("Could not fetch server tasks:", err);
    return [];
  }
});

export const fetchServerActivities = cache(async (): Promise<SolarActivity[]> => {
  try {
    const supabase = await createSolarServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("activities")
      .select("id,title,description,type,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];
    return data as unknown as SolarActivity[];
  } catch (err) {
    console.warn("Could not fetch server activities:", err);
    return [];
  }
});

export const fetchServerRepositories = cache(async (): Promise<SolarRepo[]> => {
  try {
    const supabase = await createSolarServerClient();
    const { data, error } = await supabase
      .from("repositories")
      .select("id,full_name,html_url,private,updated_at")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error || !data) return [];
    return data as unknown as SolarRepo[];
  } catch (err) {
    console.warn("Could not fetch server repositories:", err);
    return [];
  }
});
