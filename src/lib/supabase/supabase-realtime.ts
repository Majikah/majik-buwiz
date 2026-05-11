/* eslint-disable @typescript-eslint/no-explicit-any */
import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./supabase";
import { isDevEnvironment } from "@/utils/utils";

type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE" | "*";
type MajikahSupabaseSchema = "majikah" | "public";

interface RealtimeEvent<T = any> {
  type: RealtimeEventType;
  new?: T;
  old?: T;
}

export class SupabaseRealtime<T = any> {
  private table: string;
  private schema: MajikahSupabaseSchema;
  private supabase: SupabaseClient<any, any, "majikah", any, any>;
  private channels: Map<string, RealtimeChannel> = new Map();
  private listeners: Array<(event: RealtimeEvent<T>) => void> = [];

  constructor(table: string, schema: MajikahSupabaseSchema = "majikah") {
    this.supabase = createSupabaseBrowserClient();
    this.table = table;
    this.schema = schema;
  }

  // 🔑 attach external listeners
  onListenUpdate(callback: (event: RealtimeEvent<T>) => void) {
    console.log("Triggering Callback");
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private triggerListeners(event: RealtimeEvent<T>) {
    this.listeners.forEach((cb) => cb(event));
  }

  subscribeToTable(filterKey: string, filterID: string) {
    const channelKey = `${this.table}:${filterID}`;

    if (this.channels.has(channelKey)) {
      console.warn(`Already subscribed to ${channelKey}`);
      return;
    }

    const channel = this.supabase
      .channel(channelKey)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: this.schema,
          table: this.table,
          filter: `${filterKey}=eq.${filterID}`,
        },
        (payload) => {
          if (isDevEnvironment()) console.log("Raw Change Payload: ", payload);
          const event: RealtimeEvent<T> = {
            type: payload.eventType as RealtimeEventType,
            new: payload.new as T,
            old: payload.old as T,
          };
          this.triggerListeners(event);
        },
      )
      .subscribe((status) => {
        if (isDevEnvironment()) console.log("Channel status:", status);
      });

    this.channels.set(channelKey, channel);
    return channel;
  }

  unsubscribe(filterID: string) {
    const channelKey = `${this.table}:${filterID}`;
    const channel = this.channels.get(channelKey);
    if (!channel) {
      console.warn(`No channel found for ${channelKey}`);
      return;
    }
    this.supabase.removeChannel(channel);
    this.channels.delete(channelKey);
  }

  cleanup() {
    this.channels.forEach((channel) => {
      this.supabase.removeChannel(channel);
    });
    this.channels.clear();
    this.listeners = [];
  }
}
