package ir.tivachat.flash;

import java.util.HashMap;
import java.util.Map;

public final class PersianTime {

    private static final Map<String, Integer> WORDS = new HashMap<>();
    static {
        String[] names = {"صفر","یک","دو","سه","چهار","پنج","شش","هفت","هشت","نه","ده","یازده","دوازده"};
        for (int i = 0; i < names.length; i++) WORDS.put(names[i], i);
        WORDS.put("شیش", 6);
        WORDS.put("نیم", 30);
        WORDS.put("ربع", 15);
    }

    public static class Clock {
        public final int hour;
        public final int minute;
        public final boolean hasPeriod;
        Clock(int hour, int minute, boolean hasPeriod) {
            this.hour = hour;
            this.minute = minute;
            this.hasPeriod = hasPeriod;
        }
        public String text() {
            return String.format("%02d:%02d", hour, minute);
        }
    }

    public static int applyPeriod(int hour, String period) {
        if (period == null) return hour;
        if (period.equals("ظهر") || period.equals("عصر")) {
            if (hour == 12) return 12;
            return hour < 12 ? hour + 12 : hour;
        }
        if (period.equals("شب")) {
            if (hour == 12) return 0;
            return hour < 12 ? hour + 12 : hour;
        }
        return hour == 12 ? 0 : hour; // صبح / بامداد
    }

    public static Clock parse(String normalized) {
        if (normalized == null) return null;
        String period = null;
        String[] periods = {"بعد از ظهر", "ظهر", "عصر", "شب", "بامداد", "صبح"};
        for (String candidate : periods) {
            if (normalized.contains(candidate)) { period = candidate.contains("ظهر") ? "ظهر" : candidate; break; }
        }

        java.util.regex.Matcher colon = java.util.regex.Pattern.compile("(\\d{1,2})\\s*:\\s*(\\d{1,2})").matcher(normalized);
        if (colon.find()) {
            int hour = Integer.parseInt(colon.group(1));
            int minute = Integer.parseInt(colon.group(2));
            return new Clock(applyPeriod(hour, period) % 24, Math.min(59, minute), period != null);
        }

        java.util.regex.Matcher numeric = java.util.regex.Pattern.compile("(\\d{1,2})(?:\\s*و\\s*(نیم|ربع|\\d{1,2}))?").matcher(normalized);
        if (numeric.find()) {
            int hour = Integer.parseInt(numeric.group(1));
            int minute = numeric.group(2) == null ? 0 : WORDS.getOrDefault(numeric.group(2), safeInt(numeric.group(2)));
            return new Clock(applyPeriod(hour, period) % 24, minute, period != null);
        }
        return null;
    }

    /** Seconds, or -1 when the sentence has no duration. */
    public static int durationSeconds(String normalized) {
        if (normalized == null) return -1;
        int seconds = 0;
        boolean matched = false;
        if (normalized.contains("نیم ساعت")) { seconds += 1800; matched = true; }
        java.util.regex.Matcher hours = java.util.regex.Pattern.compile("(\\d+)\\s*ساعت").matcher(normalized);
        if (hours.find()) { seconds += Integer.parseInt(hours.group(1)) * 3600; matched = true; }
        java.util.regex.Matcher minutes = java.util.regex.Pattern.compile("(\\d+)\\s*دقیقه").matcher(normalized);
        if (minutes.find()) { seconds += Integer.parseInt(minutes.group(1)) * 60; matched = true; }
        return matched && seconds > 0 ? seconds : -1;
    }

    private static int safeInt(String value) {
        try { return Integer.parseInt(value); } catch (NumberFormatException error) { return 0; }
    }
}