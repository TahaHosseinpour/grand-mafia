-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('admin', 'editor', 'moderator', 'altmod', 'trialmod', 'veteran', 'contributor');

-- CreateEnum
CREATE TYPE "EmailTokenPurpose" AS ENUM ('verify', 'reset_password');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(16) NOT NULL,
    "username_key" VARCHAR(16) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email" VARCHAR(255),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "staff_role" "StaffRole",
    "is_contributor" BOOLEAN NOT NULL DEFAULT false,
    "is_tournament_mod" BOOLEAN NOT NULL DEFAULT false,
    "has_not_dismissed_signup_modal" BOOLEAN NOT NULL DEFAULT true,
    "game_settings" JSONB NOT NULL DEFAULT '{}',
    "bio" VARCHAR(500) NOT NULL DEFAULT '',
    "tou_last_agreed" VARCHAR(20),
    "last_version_seen" VARCHAR(20),
    "has_changed_name" BOOLEAN NOT NULL DEFAULT false,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "timeout_until" TIMESTAMP(3),
    "is_fixed" BOOLEAN NOT NULL DEFAULT false,
    "signup_ip" VARCHAR(64),
    "last_connected_ip" VARCHAR(64),
    "last_connected_at" TIMESTAMP(3),
    "ip_history" JSONB NOT NULL DEFAULT '[]',
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "rainbow_wins" INTEGER NOT NULL DEFAULT 0,
    "rainbow_losses" INTEGER NOT NULL DEFAULT 0,
    "elo_overall" DOUBLE PRECISION NOT NULL DEFAULT 1600,
    "elo_season" DOUBLE PRECISION NOT NULL DEFAULT 1600,
    "max_elo" DOUBLE PRECISION NOT NULL DEFAULT 1600,
    "previous_day_elo" DOUBLE PRECISION,
    "xp_overall" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "xp_season" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "previous_day_xp" DOUBLE PRECISION,
    "is_rainbow_overall" BOOLEAN NOT NULL DEFAULT false,
    "is_rainbow_season" BOOLEAN NOT NULL DEFAULT false,
    "date_rainbow_overall" TIMESTAMP(3),
    "is_on_fire" BOOLEAN NOT NULL DEFAULT false,
    "last_completed_game" TIMESTAMP(3),
    "primary_color" VARCHAR(32),
    "secondary_color" VARCHAR(32),
    "tertiary_color" VARCHAR(32),
    "background_color" VARCHAR(32),
    "text_color" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_stats" (
    "user_id" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "rainbow_wins" INTEGER NOT NULL DEFAULT 0,
    "rainbow_losses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "season_stats_pkey" PRIMARY KEY ("user_id","season")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "badge_id" VARCHAR(64) NOT NULL,
    "text" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "date_awarded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elo_snapshots" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "elo_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warnings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "moderator" VARCHAR(16) NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" INTEGER NOT NULL,
    "version" VARCHAR(20) NOT NULL DEFAULT '',
    "stats" JSONB NOT NULL DEFAULT '{}',
    "recent_games" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "email_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "purpose" "EmailTokenPurpose" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" SERIAL NOT NULL,
    "uid" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "flag" VARCHAR(32),
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "season" INTEGER NOT NULL,
    "player_count" INTEGER NOT NULL,
    "player_chats" VARCHAR(16),
    "winning_players" TEXT[],
    "losing_players" TEXT[],
    "winning_team" VARCHAR(16),
    "is_rainbow" BOOLEAN NOT NULL DEFAULT false,
    "elo_minimum" INTEGER,
    "casual_game" BOOLEAN NOT NULL DEFAULT false,
    "practice_game" BOOLEAN NOT NULL DEFAULT false,
    "custom_game" BOOLEAN NOT NULL DEFAULT false,
    "unlisted_game" BOOLEAN NOT NULL DEFAULT false,
    "is_verified_only" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "chats" JSONB NOT NULL DEFAULT '[]',
    "hidden_info_chat" JSONB NOT NULL DEFAULT '[]',
    "summary" JSONB,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_actions" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mod_user_name" VARCHAR(16) NOT NULL,
    "ip" VARCHAR(64),
    "user_acted_on" VARCHAR(64),
    "mod_notes" VARCHAR(2000),
    "action_taken" VARCHAR(64) NOT NULL,

    CONSTRAINT "mod_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banned_ips" (
    "id" SERIAL NOT NULL,
    "ip" VARCHAR(64) NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT false,
    "banned_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banned_ips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_threads" (
    "id" VARCHAR(64) NOT NULL,
    "username" VARCHAR(16) NOT NULL,
    "aem_member" VARCHAR(16) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "messages" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "mod_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_reports" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "game_uid" VARCHAR(64) NOT NULL,
    "reported_player" VARCHAR(16) NOT NULL,
    "reporting_player" VARCHAR(16) NOT NULL,
    "reason" VARCHAR(64) NOT NULL,
    "game_type" VARCHAR(32),
    "comment" VARCHAR(2000) NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "player_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_notes" (
    "id" SERIAL NOT NULL,
    "user_name" VARCHAR(16) NOT NULL,
    "noted_user" VARCHAR(16) NOT NULL,
    "note" VARCHAR(1000) NOT NULL,

    CONSTRAINT "player_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signups" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_name" VARCHAR(16) NOT NULL,
    "ip" VARCHAR(64),
    "unobfuscated_ip" VARCHAR(64),
    "type" VARCHAR(32) NOT NULL,
    "email" VARCHAR(255),

    CONSTRAINT "signups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eight_eight_counter" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(16) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eight_eight_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "key" VARCHAR(64) NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key_key" ON "users"("username_key");

-- CreateIndex
CREATE UNIQUE INDEX "badges_user_id_badge_id_key" ON "badges"("user_id", "badge_id");

-- CreateIndex
CREATE INDEX "elo_snapshots_user_id_date_idx" ON "elo_snapshots"("user_id", "date");

-- CreateIndex
CREATE INDEX "warnings_user_id_idx" ON "warnings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_tokens_token_hash_key" ON "email_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_tokens_user_id_purpose_idx" ON "email_tokens"("user_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "games_uid_key" ON "games"("uid");

-- CreateIndex
CREATE INDEX "games_date_idx" ON "games"("date");

-- CreateIndex
CREATE INDEX "games_winning_players_idx" ON "games" USING GIN ("winning_players");

-- CreateIndex
CREATE INDEX "games_losing_players_idx" ON "games" USING GIN ("losing_players");

-- CreateIndex
CREATE INDEX "mod_actions_date_idx" ON "mod_actions"("date");

-- CreateIndex
CREATE INDEX "mod_actions_user_acted_on_idx" ON "mod_actions"("user_acted_on");

-- CreateIndex
CREATE INDEX "banned_ips_ip_idx" ON "banned_ips"("ip");

-- CreateIndex
CREATE INDEX "mod_threads_username_idx" ON "mod_threads"("username");

-- CreateIndex
CREATE INDEX "player_reports_is_active_date_idx" ON "player_reports"("is_active", "date");

-- CreateIndex
CREATE UNIQUE INDEX "player_notes_user_name_noted_user_key" ON "player_notes"("user_name", "noted_user");

-- CreateIndex
CREATE INDEX "signups_date_idx" ON "signups"("date");

-- AddForeignKey
ALTER TABLE "season_stats" ADD CONSTRAINT "season_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badges" ADD CONSTRAINT "badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elo_snapshots" ADD CONSTRAINT "elo_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
