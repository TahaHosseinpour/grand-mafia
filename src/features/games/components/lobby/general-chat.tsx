'use client';

import { Megaphone, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatTime } from '@/lib/datetime';
import ChatInput from '../common/chat-input';
import { EmoteText } from '../common/chat-text';
import { playerColor } from '../common/player-color';
import { useStickToBottom } from '../common/use-stick-to-bottom';
import { emit } from '../socket';
import { useClientState } from '../store';

const STAFF_LABEL: Record<string, string> = { admin: 'مدیر کل', editor: 'ویراستار', moderator: 'ناظر' };

/** The lobby-wide chat (legacy Generalchat.jsx). */
export default function GeneralChat({ className }: { className?: string }) {
  const chats = useClientState((state) => state.generalChats);
  const userList = useClientState((state) => state.userList);
  const userName = useClientState((state) => state.userInfo.userName);
  const settings = useClientState((state) => state.userInfo.gameSettings);
  const [stickyHidden, setStickyHidden] = useState<string | null>(null);
  const list = useStickToBottom<HTMLDivElement>(chats.list.length);
  const seasonal = !settings?.disableSeasonal;
  const showSticky = chats.sticky && stickyHidden !== chats.sticky;

  return (
    <section className={`flex min-h-0 flex-col ${className ?? ''}`} aria-label="چت عمومی">
      {showSticky ? (
        <div className="mb-2 flex items-start gap-2 rounded-xl border-s-4 border-lib bg-lib/12 px-3 py-2 text-[0.9rem] text-lib-soft">
          <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="flex-1">
            <EmoteText text={chats.sticky} />
          </p>
          <button type="button" onClick={() => setStickyHidden(chats.sticky)} aria-label="بستن" className="cursor-pointer text-lib-soft/70 hover:text-lib-soft">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl bg-surface px-3 py-2">
        {chats.list.length === 0 ? <p className="py-10 text-center text-fg-faint">هنوز پیامی نیست. اولین نفر باشید!</p> : null}
        <ul className="flex flex-col gap-1.5">
          {chats.list.map((chat, i) => {
            const user = userList.find((entry) => entry.userName === chat.userName);
            const color = settings?.disablePlayerColorsInChat ? undefined : playerColor(user, seasonal, settings?.disableElo);
            return (
              <li key={`${chat.time}-${i}`} className="leading-relaxed break-words">
                {settings?.enableTimestamps ? <span className="me-1.5 text-[0.75rem] text-fg-faint">{formatTime(chat.time)}</span> : null}
                {chat.staffRole && STAFF_LABEL[chat.staffRole] ? (
                  <Badge tone="fas" className="me-1 px-1.5 py-0 text-[0.7rem]">
                    {STAFF_LABEL[chat.staffRole]}
                  </Badge>
                ) : null}
                {chat.userName === 'ناشناس' ? (
                  <span className="font-bold text-fg-muted">{chat.userName}</span>
                ) : (
                  <a href={`#/profile/${encodeURIComponent(chat.userName)}`} className="font-bold text-fg-muted hover:underline" style={color ? { color } : undefined} dir="auto">
                    {chat.userName}
                  </a>
                )}
                <span className="text-fg-faint">: </span>
                <span className="text-fg" dir="auto">
                  <EmoteText text={chat.chat} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <ChatInput
        className="mt-2"
        onSend={(chat) => emit('addNewGeneralChat', { chat })}
        disabled={!userName || Boolean(settings?.isPrivate)}
        disabledText={!userName ? 'برای گفتگو وارد حساب خود شوید.' : 'بازیکنان با پروفایل خصوصی در چت عمومی پیام نمی‌دهند.'}
        placeholder="به همه بگویید…"
      />
    </section>
  );
}
