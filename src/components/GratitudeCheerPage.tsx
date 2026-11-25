import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  MessageCircle,
  Send,
  Clock,
  Trash2,
  X,
  Lock,
  AlertTriangle,
  ThumbsUp,
} from 'lucide-react';
import {
  Area,
  Company,
  HuongKhiItem,
  ReactionType,
  UserAccount,
} from '../types/edulms';
import { isAdminRole } from '../utils/rbac';
import {
  DEFAULT_VOCABULARY_CONFIG,
  SystemVocabularyConfig,
  encodeSensitiveText,
  findSensitiveMatches,
  formatRemainingExpiry,
} from '../utils/wordEncoder';
import { CustomSelect } from './CustomSelect';

export const REACTION_CONFIG: Record<
  ReactionType,
  { label: string; emoji: string; color: string; bgColor: string }
> = {
  heart: {
    label: 'Yêu thích',
    emoji: '❤️',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/50',
  },
  pray: {
    label: 'Amen / Cảm tạ',
    emoji: '🙏',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/50',
  },
  fire: {
    label: 'Hào hứng',
    emoji: '🔥',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/50',
  },
  praise: {
    label: 'Ngợi khen',
    emoji: '⭐',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/50',
  },
  like: {
    label: 'Thích',
    emoji: '👍',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/50',
  },
  blessing: {
    label: 'Phước lành',
    emoji: '🕊️',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/50',
  },
};

interface GratitudeCheerPageProps {
  huongKhiList: HuongKhiItem[];
  currentUser: UserAccount | null;
  companies: Company[];
  areas: Area[];
  vocabularyConfig?: SystemVocabularyConfig;
  onAddHuongKhi: (item: Omit<HuongKhiItem, 'id' | 'likesCount'>) => Promise<void> | void;
  onDeleteHuongKhi?: (id: string) => Promise<void> | void;
  onAddTurboJournal?: (payload: { title: string; content: string }) => Promise<void> | void;
  onReactHuongKhi: (id: string, reaction: ReactionType) => void;
  onAddComment: (huongKhiId: string, content: string) => void;
  onOpenAuthModal: () => void;
  onNavigateProfile?: () => void;
  onShowNotification: (msg: string) => void;
}

const getTotalReactions = (story: HuongKhiItem): number => {
  if (story.reactions) {
    return (
      (story.reactions.heart || 0) +
      (story.reactions.pray || 0) +
      (story.reactions.praise || 0) +
      (story.reactions.fire || 0) +
      (story.reactions.like || 0) +
      (story.reactions.blessing || 0)
    );
  }
  return story.likesCount || 0;
};

export const GratitudeCheerPage: React.FC<GratitudeCheerPageProps> = ({
  huongKhiList,
  currentUser,
  companies,
  areas,
  vocabularyConfig = DEFAULT_VOCABULARY_CONFIG,
  onAddHuongKhi,
  onDeleteHuongKhi,
  onAddTurboJournal,
  onReactHuongKhi,
  onAddComment,
  onOpenAuthModal,
  onNavigateProfile,
  onShowNotification,
}) => {
  const [scopeTab, setScopeTab] = useState<'ALL' | 'MINE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'TOP_REACTIONS'>('NEWEST');

  const [activeReactionPickerId, setActiveReactionPickerId] = useState<string | null>(null);
  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  // Composer Modal
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerKind, setComposerKind] = useState<'GRATITUDE' | 'TURBO'>('GRATITUDE');
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm modal
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<HuongKhiItem | null>(null);

  const areaOptions = useMemo(() => {
    if (companyFilter === 'ALL') return areas;
    return areas.filter((a) => a.companyCode === companyFilter);
  }, [areas, companyFilter]);

  const filteredPosts = useMemo(() => {
    const kw = searchQuery.trim().toLowerCase();
    const list = huongKhiList.filter((item) => {
      if (scopeTab === 'MINE') {
        if (!currentUser) return false;
        const isOwn =
          item.authorUid === currentUser.id ||
          (currentUser.memberId && item.authorId === currentUser.memberId) ||
          item.authorId === currentUser.id;
        if (!isOwn) return false;
      }
      if (companyFilter !== 'ALL' && item.companyCode !== companyFilter) return false;
      if (areaFilter !== 'ALL' && item.areaCode !== areaFilter) return false;
      if (!kw) return true;
      return (
        item.title.toLowerCase().includes(kw) ||
        item.content.toLowerCase().includes(kw) ||
        item.authorName.toLowerCase().includes(kw) ||
        item.companyCode.toLowerCase().includes(kw) ||
        item.areaCode.toLowerCase().includes(kw)
      );
    });

    if (sortBy === 'TOP_REACTIONS') {
      return [...list].sort((a, b) => getTotalReactions(b) - getTotalReactions(a));
    }
    return [...list].sort((a, b) =>
      (b.createdAtIso || b.id || '').localeCompare(a.createdAtIso || a.id || '')
    );
  }, [huongKhiList, scopeTab, currentUser, companyFilter, areaFilter, searchQuery, sortBy]);

  const selectedStory = useMemo(
    () => (selectedStoryId ? huongKhiList.find((s) => s.id === selectedStoryId) || null : null),
    [selectedStoryId, huongKhiList]
  );

  const sensitiveMatches = useMemo(
    () => findSensitiveMatches(`${titleInput}\n${contentInput}`, vocabularyConfig?.rules),
    [titleInput, contentInput, vocabularyConfig?.rules]
  );

  const encodedPreview = useMemo(
    () =>
      encodeSensitiveText(
        contentInput,
        vocabularyConfig?.rules,
        vocabularyConfig?.enabled !== false
      ),
    [contentInput, vocabularyConfig?.rules, vocabularyConfig?.enabled]
  );

  const openComposer = (kind: 'GRATITUDE' | 'TURBO') => {
    if (!currentUser) {
      onShowNotification('Vui lòng đăng nhập để viết nhật ký.');
      onOpenAuthModal();
      return;
    }
    setComposerKind(kind);
    setIsComposerOpen(true);
  };

  const handleSubmitJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    if (!titleInput.trim() || !contentInput.trim()) {
      onShowNotification('Vui lòng nhập đầy đủ tiêu đề và nội dung.');
      return;
    }

    setIsSaving(true);
    try {
      if (composerKind === 'TURBO') {
        if (onAddTurboJournal) {
          await onAddTurboJournal({
            title: titleInput.trim(),
            content: contentInput.trim(),
          });
        }
        setTitleInput('');
        setContentInput('');
        setIsComposerOpen(false);
        onShowNotification('Đã lưu Nhật ký turbo vào mục Bài Viết trong Hồ sơ cá nhân!');
      } else {
        await onAddHuongKhi({
          authorId: currentUser.memberId || currentUser.id,
          authorUid: currentUser.id,
          authorName: currentUser.fullName,
          authorAvatar: currentUser.avatarUrl,
          companyCode: currentUser.companyCode,
          areaCode: currentUser.areaCode,
          departmentCode: currentUser.departmentCode,
          title: titleInput.trim(),
          content: contentInput.trim(),
          category: 'GRATITUDE',
          journalType: 'GRATITUDE',
          date: new Date().toLocaleDateString('vi-VN'),
          isFeatured: true,
          reactions: {
            heart: 1,
            pray: 1,
            praise: 0,
            fire: 0,
            blessing: 0,
            like: 0,
          },
          comments: [],
        });
        setTitleInput('');
        setContentInput('');
        setIsComposerOpen(false);
        onShowNotification('Đã đăng Nhật ký cảm tạ công khai (tự ẩn sau 24 giờ)!');
      }
    } catch (err: any) {
      onShowNotification(err?.message || 'Không thể lưu nhật ký lên máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCommentSubmit = (storyId: string) => {
    const text = commentInputs[storyId]?.trim();
    if (!text) return;
    onAddComment(storyId, text);
    setCommentInputs((prev) => ({ ...prev, [storyId]: '' }));
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteItem || !onDeleteHuongKhi) return;
    await onDeleteHuongKhi(confirmDeleteItem.id);
    if (selectedStoryId === confirmDeleteItem.id) setSelectedStoryId(null);
    setConfirmDeleteItem(null);
  };

  const canDeletePost = (item: HuongKhiItem): boolean => {
    if (!currentUser) return false;
    if (isAdminRole(currentUser.role)) return true;
    return (
      item.authorUid === currentUser.id ||
      (Boolean(currentUser.memberId) && item.authorId === currentUser.memberId) ||
      item.authorId === currentUser.id
    );
  };

  const totalCommunityReactions = useMemo(
    () => huongKhiList.reduce((acc, item) => acc + getTotalReactions(item), 0),
    [huongKhiList]
  );

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Nhật Ký &amp; Cổ Vũ
              </h1>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                {huongKhiList.length} bài (24h) · {totalCommunityReactions} cảm xúc
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onAddTurboJournal && (
            <button
              type="button"
              onClick={() => openComposer('TURBO')}
              className="h-9 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Nhật ký turbo</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => openComposer('GRATITUDE')}
            className="h-9 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Viết Nhật ký cảm tạ</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col lg:flex-row lg:items-center gap-2.5">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setScopeTab('ALL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              scopeTab === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tất cả ({huongKhiList.length})
          </button>
          <button
            type="button"
            onClick={() => setScopeTab('MINE')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              scopeTab === 'MINE'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Của tôi
          </button>
        </div>

        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề, nội dung, tên thành viên..."
            className="w-full h-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/25"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 shrink-0">
          <div className="min-w-[125px]">
            <CustomSelect
              size="sm"
              searchable={false}
              value={companyFilter}
              onChange={(val) => {
                setCompanyFilter(val);
                setAreaFilter('ALL');
              }}
              options={[
                { value: 'ALL', label: 'Tất cả Sion' },
                ...companies.map((c) => ({ value: c.code, label: c.name || c.code })),
              ]}
              ariaLabel="Lọc theo Sion"
            />
          </div>

          <div className="min-w-[125px]">
            <CustomSelect
              size="sm"
              searchable={false}
              value={areaFilter}
              onChange={setAreaFilter}
              options={[
                { value: 'ALL', label: 'Tất cả Khu vực' },
                ...areaOptions.map((a) => ({ value: a.code, label: `KV ${a.code}` })),
              ]}
              ariaLabel="Lọc theo Khu vực"
            />
          </div>

          <div className="col-span-2 sm:col-span-1 min-w-[130px]">
            <CustomSelect
              size="sm"
              searchable={false}
              value={sortBy}
              onChange={(val) => setSortBy(val as 'NEWEST' | 'TOP_REACTIONS')}
              options={[
                { value: 'NEWEST', label: 'Mới nhất' },
                { value: 'TOP_REACTIONS', label: 'Nhiều cổ vũ nhất' },
              ]}
              ariaLabel="Sắp xếp bài viết"
            />
          </div>
        </div>
      </div>

      {/* Feed Grid or Empty State */}
      {filteredPosts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {filteredPosts.map((story) => {
            const totalReactions = getTotalReactions(story);
            const commentsCount = story.comments?.length || 0;
            const isCommentsOpen = expandedCommentsId === story.id;
            const userCurrentReaction = story.userReaction
              ? REACTION_CONFIG[story.userReaction]
              : null;
            const remainingLabel = formatRemainingExpiry(story.expiresAtIso);

            return (
              <article
                key={story.id}
                className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between gap-3"
              >
                <div className="space-y-2.5">
                  {/* Author & Unboxed Inline Metadata */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {story.authorAvatar ? (
                        <img
                          src={story.authorAvatar}
                          alt={story.authorName}
                          className="w-9 h-9 rounded-full object-cover shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                          {story.authorName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          {story.authorName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
                          <span>{story.companyCode}</span>
                          <span>·</span>
                          <span>KV {story.areaCode}</span>
                          <span>·</span>
                          <span className="font-mono">{story.date}</span>
                          {remainingLabel && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                                <Clock className="w-3 h-3" />
                                {remainingLabel}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {canDeletePost(story) && onDeleteHuongKhi && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteItem(story)}
                        title="Xóa bài viết"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Title & Content */}
                  <div
                    onClick={() => setSelectedStoryId(story.id)}
                    className="cursor-pointer group space-y-1.5"
                  >
                    <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition leading-snug">
                      {story.title}
                    </h2>
                    <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line line-clamp-5">
                      {story.content}
                    </p>
                  </div>
                </div>

                {/* Summary + Action Bar */}
                <div className="space-y-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="font-semibold">
                      ❤️ 🙏 🔥 <strong className="text-slate-700 dark:text-slate-200">{totalReactions}</strong> lượt cổ vũ
                    </span>
                    <span>{commentsCount} bình luận</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 relative">
                    <div
                      className="relative"
                      onMouseEnter={() => setActiveReactionPickerId(story.id)}
                      onMouseLeave={() => setActiveReactionPickerId(null)}
                    >
                      {activeReactionPickerId === story.id && (
                        <div className="absolute -top-11 left-0 z-30 flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
                          {(Object.keys(REACTION_CONFIG) as ReactionType[]).map((rType) => {
                            const cfg = REACTION_CONFIG[rType];
                            return (
                              <button
                                key={rType}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReactHuongKhi(story.id, rType);
                                  setActiveReactionPickerId(null);
                                }}
                                className="text-lg hover:scale-125 transition-transform p-1 cursor-pointer"
                                title={cfg.label}
                              >
                                {cfg.emoji}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          onReactHuongKhi(story.id, story.userReaction ? 'like' : 'heart')
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          userCurrentReaction
                            ? `${userCurrentReaction.bgColor} ${userCurrentReaction.color}`
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {userCurrentReaction ? (
                          <span>{userCurrentReaction.emoji}</span>
                        ) : (
                          <ThumbsUp className="w-3.5 h-3.5" />
                        )}
                        <span>{userCurrentReaction ? userCurrentReaction.label : 'Cổ vũ'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCommentsId(isCommentsOpen ? null : story.id)
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Bình luận ({commentsCount})</span>
                    </button>
                  </div>

                  {/* Expandable Comments */}
                  {isCommentsOpen && (
                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2.5 animate-in fade-in">
                      {story.comments && story.comments.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {story.comments.map((comment) => (
                            <div
                              key={comment.id}
                              className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-2.5 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-900 dark:text-white mb-0.5">
                                <span className="truncate">
                                  {comment.authorName}
                                  {comment.companyCode && (
                                    <span className="font-normal text-slate-500 dark:text-slate-400">
                                      {' · '}
                                      {comment.companyCode}
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                  {comment.createdAt}
                                </span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                {comment.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={commentInputs[story.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [story.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCommentSubmit(story.id);
                            }
                          }}
                          placeholder="Viết lời khích lệ..."
                          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                        />
                        <button
                          type="button"
                          onClick={() => handleCommentSubmit(story.id)}
                          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>Gửi</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 border border-slate-200/80 dark:border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
            {huongKhiList.length === 0
              ? 'Chưa có Nhật ký cảm tạ nào trong 24 giờ qua'
              : 'Không tìm thấy bài viết phù hợp'}
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => openComposer('GRATITUDE')}
              className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Viết Nhật ký cảm tạ</span>
            </button>
            {onNavigateProfile && (
              <button
                type="button"
                onClick={onNavigateProfile}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                Xem Bài Viết cá nhân
              </button>
            )}
          </div>
        </div>
      )}

      {/* Full Story Detail Modal */}
      {selectedStory && (
        <div
          onClick={() => setSelectedStoryId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-6 relative cursor-default space-y-4"
          >
            <button
              type="button"
              onClick={() => setSelectedStoryId(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 pr-8">
              <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <strong className="text-slate-800 dark:text-slate-200">{selectedStory.authorName}</strong>
                {' · '}
                {selectedStory.companyCode} · KV {selectedStory.areaCode} · {selectedStory.date}
                {formatRemainingExpiry(selectedStory.expiresAtIso)
                  ? ` · ${formatRemainingExpiry(selectedStory.expiresAtIso)}`
                  : ''}
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white leading-snug">
                {selectedStory.title}
              </h3>
            </div>

            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line border-t border-slate-100 dark:border-slate-800 pt-3">
              {selectedStory.content}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
              {(Object.keys(REACTION_CONFIG) as ReactionType[]).map((rType) => {
                const cfg = REACTION_CONFIG[rType];
                const isMine = selectedStory.userReaction === rType;
                return (
                  <button
                    key={rType}
                    type="button"
                    onClick={() => onReactHuongKhi(selectedStory.id, rType)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                      isMine
                        ? `${cfg.bgColor} ${cfg.color} ring-1 ring-current`
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>{cfg.emoji}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Comments inside detail modal */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              {selectedStory.comments && selectedStory.comments.length > 0 && (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {selectedStory.comments.map((c) => (
                    <div
                      key={c.id}
                      className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-2.5 text-xs"
                    >
                      <div className="flex justify-between text-[11px] font-bold text-slate-900 dark:text-white">
                        <span>{c.authorName}</span>
                        <span className="text-slate-400 font-mono text-[10px]">{c.createdAt}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mt-1">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentInputs[selectedStory.id] || ''}
                  onChange={(e) =>
                    setCommentInputs((prev) => ({
                      ...prev,
                      [selectedStory.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCommentSubmit(selectedStory.id);
                    }
                  }}
                  placeholder="Viết lời khích lệ..."
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => handleCommentSubmit(selectedStory.id)}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Composer Modal */}
      {isComposerOpen && (
        <div
          onClick={() => setIsComposerOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 relative cursor-default"
          >
            <button
              type="button"
              onClick={() => setIsComposerOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4 pr-8">
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  composerKind === 'TURBO'
                    ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                }`}
              >
                {composerKind === 'TURBO' ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {composerKind === 'TURBO' ? 'Viết Nhật ký turbo' : 'Viết Nhật ký cảm tạ'}
              </h3>
            </div>

            <form onSubmit={handleSubmitJournal} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setComposerKind('GRATITUDE')}
                  className={`p-2.5 rounded-2xl border text-left transition cursor-pointer ${
                    composerKind === 'GRATITUDE'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-200'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Nhật ký cảm tạ</span>
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5">Công khai · Tự ẩn sau 24h</div>
                </button>

                {onAddTurboJournal && (
                  <button
                    type="button"
                    onClick={() => setComposerKind('TURBO')}
                    className={`p-2.5 rounded-2xl border text-left transition cursor-pointer ${
                      composerKind === 'TURBO'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 text-indigo-950 dark:text-indigo-200'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Nhật ký turbo</span>
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">Riêng tư · Lưu tường cá nhân</div>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề *
                </label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder={
                    composerKind === 'TURBO'
                      ? 'Tiêu đề Nhật ký turbo...'
                      : 'Tiêu đề Nhật ký cảm tạ...'
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nội dung *
                </label>
                <textarea
                  rows={4}
                  value={contentInput}
                  onChange={(e) => setContentInput(e.target.value)}
                  placeholder="Viết nội dung nhật ký (tự động viết tắt theo từ điển khi lưu)..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs leading-relaxed text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              {vocabularyConfig?.enabled !== false && sensitiveMatches.length > 0 && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/60 space-y-1.5 text-[11px]">
                  <div className="font-extrabold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Tự động viết tắt {sensitiveMatches.length} cụm từ:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sensitiveMatches.map((m) => (
                      <span
                        key={m.source}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-700 text-slate-700 dark:text-slate-200 font-semibold"
                      >
                        {m.source} →{' '}
                        <strong className="text-emerald-700 dark:text-emerald-400">{m.code}</strong>
                      </span>
                    ))}
                  </div>
                  {contentInput.trim() && (
                    <div className="pt-1 text-slate-600 dark:text-slate-300 border-t border-emerald-200/70 dark:border-emerald-800/60">
                      <span className="font-bold">Xem trước: </span>
                      <span className="italic">{encodedPreview}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                    composerKind === 'TURBO'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Đang lưu...' : 'Đăng bài'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDeleteItem && (
        <div
          onClick={() => setConfirmDeleteItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Xóa Nhật ký cảm tạ?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Bạn muốn xóa bài <strong>&ldquo;{confirmDeleteItem.title}&rdquo;</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
