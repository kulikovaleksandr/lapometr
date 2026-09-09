import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Reminder {
  userId: string;
  petName: string;
  text: string;
  type: "activity" | "vet";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Получаем все снапшоты
    const { data: snapshots, error: snapshotsError } = await supabaseAdmin
      .from("sync_snapshots")
      .select("*");

    if (snapshotsError) {
      console.error("Failed to fetch snapshots:", snapshotsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch snapshots" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!snapshots || snapshots.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No snapshots found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = Date.now();
    const remindersByUser: Record<string, Reminder[]> = {};

    // Обрабатываем каждый снапшот
    for (const snapshot of snapshots) {
      const db = snapshot.data;
      const userId = snapshot.user_id;

      if (!db || !db.users || !db.pets || !db.acts || !db.logs) {
        continue;
      }

      const user = db.users.find((u: any) => u.id === userId);
      if (!user) continue;

      // Получаем настройки Telegram
      const telegramConfig = db.telegram || {};
      const telegramEnabled = telegramConfig.enabled && telegramConfig.botToken && telegramConfig.chatId;

      // Получаем настройки Web Push
      const { data: pushSubscriptions } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId);

      const pushEnabled = pushSubscriptions && pushSubscriptions.length > 0;

      if (!telegramEnabled && !pushEnabled) {
        continue; // Пропускаем пользователей без настроенных уведомлений
      }

      // Собираем напоминания для всех питомцев пользователя
      for (const pet of db.pets) {
        if (!pet.ownerIds.includes(userId)) continue;

        const petName = pet.name;

        // 1. Проверяем просроченные активности
        if (telegramConfig.remindDue !== false) {
          for (const act of db.acts.filter((a: any) => a.petId === pet.id)) {
            if (!act.remindH || act.remindH <= 0) continue;

            // Находим последнюю запись этой активности
            const lastLog = db.logs
              .filter((l: any) => l.actId === act.id)
              .sort((a: any, b: any) => b.at - a.at)[0];

            let overdueMin = 0;
            if (!lastLog) {
              // Если активности никогда не было, считаем просроченной
              overdueMin = 1;
            } else {
              const dueAt = lastLog.at + act.remindH * 3600000;
              if (dueAt < now) {
                overdueMin = Math.round((now - dueAt) / 60000);
              }
            }

            if (overdueMin > 0) {
              const text = `«${act.title}» — просрочено на ${Math.round(overdueMin / 60)} ч`;
              
              if (!remindersByUser[userId]) {
                remindersByUser[userId] = [];
              }
              
              remindersByUser[userId].push({
                userId,
                petName,
                text,
                type: "activity",
              });
            }
          }
        }

        // 2. Проверяем вет-события на сегодня
        if (telegramConfig.remindVet !== false) {
          const { data: vetEvents } = await supabaseAdmin
            .from("vet_events")
            .select("*")
            .eq("pet_id", pet.id);

          if (vetEvents) {
            for (const event of vetEvents) {
              const eventDate = new Date(event.date);
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              // Проверяем, наступило ли событие сегодня
              if (eventDate.getTime() === today.getTime()) {
                const timeStr = event.time ? ` в ${event.time}` : "";
                const text = `«${event.title}» — сегодня${timeStr}`;
                
                if (!remindersByUser[userId]) {
                  remindersByUser[userId] = [];
                }
                
                remindersByUser[userId].push({
                  userId,
                  petName,
                  text,
                  type: "vet",
                });
              }
            }
          }
        }
      }
    }

    // Отправляем напоминания каждому пользователю
    let totalSent = 0;

    for (const [userId, reminders] of Object.entries(remindersByUser)) {
      if (reminders.length === 0) continue;

      const snapshot = snapshots.find((s: any) => s.user_id === userId);
      if (!snapshot) continue;

      const db = snapshot.data;
      const telegramConfig = db.telegram || {};

      // Получаем имя питомца для первого напоминания
      const firstReminder = reminders[0];

      // Формируем сводное сообщение
      const messageLines = reminders.map((r) => `• ${r.petName}: ${r.text}`);
      const message = `🐾 <b>Лапометр: пора позаботиться</b>\n\n${messageLines.join("\n")}\n\nОтметьте выполнение в журнале!`;

      // Отправляем в Telegram
      if (telegramConfig.enabled && telegramConfig.botToken && telegramConfig.chatId) {
        try {
          await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: telegramConfig.chatId,
              text: message,
              parse_mode: "HTML",
            }),
          });
          totalSent++;
        } catch (error) {
          console.error(`Failed to send Telegram to ${userId}:`, error);
        }
      }

      // Отправляем через Web Push
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/push-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            userId,
            payload: {
              title: "Лапометр",
              body: `${firstReminder.petName}: ${firstReminder.text}`,
              icon: "/icon.svg",
              badge: "/icon.svg",
              tag: "lapometr-reminder",
              url: "/",
            },
          }),
        });
        totalSent++;
      } catch (error) {
        console.error(`Failed to send push to ${userId}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, users: Object.keys(remindersByUser).length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
