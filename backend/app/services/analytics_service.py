import math
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import UserSettings
from app.models.vocabulary import Word, WordProgress
from app.models.learning import DailyActivity, WordReview, StudySession
from app.schemas.analytics import (
    DailyActivityChartPoint,
    GoalProgressOut,
    RecentActivityItem,
    DashboardStatsOut,
    WeakWordOut,
    LevelAssessmentOut,
    CefrMilestoneOut,
    ActivityHeatmapDay,
    ActivityHeatmapOut,
)

UZBEK_DAY_NAMES = ["Dush", "Sesh", "Chor", "Pay", "Juma", "Shan", "Yak"]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AnalyticsService:
    async def get_dashboard_analytics(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> DashboardStatsOut:
        now = utc_now() + timedelta(seconds=5)
        today = utc_now().date()

        # 1. Vocabulary metrics
        total_words_stmt = select(func.count(Word.id)).where(Word.user_id == user_id)
        total_words = (await db.execute(total_words_stmt)).scalar_one() or 0

        due_stmt = (
            select(func.count(WordProgress.id))
            .where(WordProgress.user_id == user_id, WordProgress.due_date <= now)
        )
        words_due_today = (await db.execute(due_stmt)).scalar_one() or 0

        mastered_stmt = (
            select(func.count(WordProgress.id))
            .where(WordProgress.user_id == user_id, WordProgress.is_mastered == True)  # noqa: E712
        )
        words_mastered = (await db.execute(mastered_stmt)).scalar_one() or 0

        weak_stmt = (
            select(func.count(WordProgress.id))
            .where(
                WordProgress.user_id == user_id,
                (WordProgress.is_weak == True) | (WordProgress.times_incorrect > 0),  # noqa: E712
            )
        )
        words_weak = (await db.execute(weak_stmt)).scalar_one() or 0

        # 2. Total active study time across all days
        total_time_stmt = select(func.sum(DailyActivity.total_active_seconds)).where(
            DailyActivity.user_id == user_id
        )
        total_active_seconds_all = (await db.execute(total_time_stmt)).scalar() or 0
        total_study_time_minutes = total_active_seconds_all // 60

        # 3. Overall review accuracy
        acc_stmt = select(
            func.count(WordReview.id),
            func.sum(case((WordReview.is_correct == True, 1), else_=0)),  # noqa: E712
        ).where(WordReview.user_id == user_id)
        total_revs, total_correct = (await db.execute(acc_stmt)).first() or (0, 0)
        overall_accuracy_percent = (
            round((total_correct / total_revs) * 100.0, 1) if total_revs and total_revs > 0 else 100.0
        )

        # 4. Today's DailyActivity & Streak
        today_act_stmt = select(DailyActivity).where(
            DailyActivity.user_id == user_id,
            DailyActivity.activity_date == today,
        )
        today_act = (await db.execute(today_act_stmt)).scalars().first()

        words_learned_today = today_act.words_learned if today_act else 0
        words_reviewed_today = today_act.words_reviewed if today_act else 0
        today_study_time_seconds = today_act.total_active_seconds if today_act else 0
        today_study_time_minutes = today_study_time_seconds // 60

        streak_days = 0
        if today_act and today_act.streak_day_count > 0:
            streak_days = today_act.streak_day_count
        else:
            yesterday = today - timedelta(days=1)
            yest_act_stmt = select(DailyActivity).where(
                DailyActivity.user_id == user_id,
                DailyActivity.activity_date == yesterday,
            )
            yest_act = (await db.execute(yest_act_stmt)).scalars().first()
            if yest_act and yest_act.streak_day_count > 0:
                streak_days = yest_act.streak_day_count

        # 5. User settings & goals
        settings_stmt = select(UserSettings).where(UserSettings.user_id == user_id)
        settings_obj = (await db.execute(settings_stmt)).scalars().first()

        daily_words_goal = settings_obj.daily_words_goal if settings_obj else 10
        daily_review_goal = settings_obj.daily_review_goal if settings_obj else 20
        daily_study_time_goal = settings_obj.daily_study_time_minutes if settings_obj else 20

        goals = GoalProgressOut(
            daily_words_goal=daily_words_goal,
            words_learned_today=words_learned_today,
            words_goal_percent=round(min((words_learned_today / daily_words_goal) * 100.0, 100.0), 1),
            daily_review_goal=daily_review_goal,
            words_reviewed_today=words_reviewed_today,
            review_goal_percent=round(min((words_reviewed_today / daily_review_goal) * 100.0, 100.0), 1),
            daily_study_time_minutes=daily_study_time_goal,
            study_time_minutes_today=today_study_time_minutes,
            study_time_goal_percent=round(min((today_study_time_minutes / daily_study_time_goal) * 100.0, 100.0), 1),
        )

        # 6. Weekly chart (last 7 days)
        seven_days_ago = today - timedelta(days=6)
        week_stmt = select(DailyActivity).where(
            DailyActivity.user_id == user_id,
            DailyActivity.activity_date >= seven_days_ago,
            DailyActivity.activity_date <= today,
        )
        week_acts = (await db.execute(week_stmt)).scalars().all()
        week_map = {act.activity_date: act for act in week_acts}

        weekly_chart = []
        for i in range(7):
            d = seven_days_ago + timedelta(days=i)
            day_name = UZBEK_DAY_NAMES[d.weekday()]
            act = week_map.get(d)
            point = DailyActivityChartPoint(
                date=d.isoformat(),
                day_name=day_name,
                active_minutes=(act.total_active_seconds // 60) if act else 0,
                words_learned=act.words_learned if act else 0,
                words_reviewed=act.words_reviewed if act else 0,
            )
            weekly_chart.append(point)

        # 7. Recent activities (top 5 recent reviews / words)
        recent_revs_stmt = (
            select(WordReview, Word.english_word)
            .join(Word, WordReview.word_id == Word.id)
            .where(WordReview.user_id == user_id)
            .order_by(WordReview.created_at.desc())
            .limit(5)
        )
        recent_revs = (await db.execute(recent_revs_stmt)).all()

        recent_activities = []
        for rev, en_word in recent_revs:
            status_text = "to'g'ri topildi" if rev.is_correct else "xato qilindi"
            recent_activities.append(
                RecentActivityItem(
                    id=rev.id,
                    type="review",
                    description=f"'{en_word}' so'zi takrorlandi ({status_text})",
                    created_at=rev.created_at,
                    is_success=rev.is_correct,
                )
            )

        # 8. Suggested action
        is_first_time = total_words == 0
        if is_first_time:
            suggested_action = (
                "Xush kelibsiz! Dastlabki so'zlaringizni qo'shish uchun fayl yuklang "
                "yoki 'So'z qo'shish' orqali yangi so'z kiriting."
            )
        elif words_due_today > 0:
            suggested_action = (
                f"Bugun takrorlashingiz lozim bo'lgan {words_due_today} ta so'z bor. "
                f"Kuningizni takrorlashdan boshlang!"
            )
        elif words_learned_today < daily_words_goal:
            diff = daily_words_goal - words_learned_today
            suggested_action = (
                f"Kunlik so'z maqsadiga erishish uchun yana {diff} ta yangi so'z o'rganing."
            )
        else:
            suggested_action = (
                "Bugungi barcha maqsadlaringiz bajarildi! O'rgangan so'zlaringiz asosida "
                "yangi Mini Hikoya o'qib ko'ring."
            )

        return DashboardStatsOut(
            total_words=total_words,
            words_due_today=words_due_today,
            words_learned_today=words_learned_today,
            words_reviewed_today=words_reviewed_today,
            words_mastered=words_mastered,
            words_weak=words_weak,
            streak_days=streak_days,
            today_study_time_seconds=today_study_time_seconds,
            today_study_time_minutes=today_study_time_minutes,
            total_study_time_minutes=total_study_time_minutes,
            overall_accuracy_percent=overall_accuracy_percent,
            goals=goals,
            weekly_chart=weekly_chart,
            recent_activities=recent_activities,
            suggested_action=suggested_action,
            is_first_time_user=is_first_time,
        )

    async def get_weak_words_list(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
        limit: int = 20,
        randomize: bool = False,
    ) -> List[WeakWordOut]:
        stmt = (
            select(Word, WordProgress)
            .join(WordProgress, Word.id == WordProgress.word_id)
            .where(
                Word.user_id == user_id,
                (WordProgress.is_weak == True) | (WordProgress.times_incorrect > 0),  # noqa: E712
            )
        )
        if randomize:
            stmt = stmt.order_by(func.random()).limit(limit)
        else:
            stmt = stmt.order_by(
                WordProgress.times_incorrect.desc(),
                WordProgress.is_weak.desc(),
                WordProgress.times_reviewed.desc(),
            ).limit(limit)

        result = await db.execute(stmt)
        rows = result.all()

        weak_list = []
        for word, prog in rows:
            accuracy = (
                round((prog.times_correct / prog.times_reviewed) * 100.0, 1)
                if prog.times_reviewed > 0
                else 0.0
            )
            item = WeakWordOut(
                id=word.id,
                english_word=word.english_word,
                uzbek_translation=word.uzbek_translation,
                part_of_speech=word.part_of_speech,
                phonetic=word.phonetic,
                cefr_level=word.cefr_level,
                times_reviewed=prog.times_reviewed,
                times_incorrect=prog.times_incorrect,
                accuracy_percent=accuracy,
                last_reviewed_at=prog.last_reviewed_at,
                repetition_number=prog.repetition_number,
                is_mastered=prog.is_mastered,
            )
            weak_list.append(item)

        return weak_list

    async def get_level_assessment(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> LevelAssessmentOut:
        # 1. Total user words
        total_stmt = select(func.count(Word.id)).where(Word.user_id == user_id)
        total_res = await db.execute(total_stmt)
        total_words = total_res.scalar() or 0

        # 2. Mastered words
        mastered_stmt = (
            select(func.count(WordProgress.id))
            .join(Word, WordProgress.word_id == Word.id)
            .where(Word.user_id == user_id, WordProgress.is_mastered == True)  # noqa: E712
        )
        mastered_res = await db.execute(mastered_stmt)
        words_mastered = mastered_res.scalar() or 0

        # 3. CEFR level distribution
        stmt = (
            select(Word.cefr_level, func.count(Word.id))
            .where(Word.user_id == user_id)
            .group_by(Word.cefr_level)
        )
        result = await db.execute(stmt)
        rows = result.all()

        breakdown = {"A1": 0, "A2": 0, "B1": 0, "B2": 0, "C1": 0, "C2": 0}
        tagged_total = 0
        for cefr, count in rows:
            if cefr and cefr.upper() in breakdown:
                breakdown[cefr.upper()] = count
                tagged_total += count

        # If some words don't have CEFR tags, allocate untagged words
        untagged = max(0, total_words - tagged_total)
        if untagged > 0:
            breakdown["A1"] += untagged

        # Determine level strictly based on MASTERED vocabulary (not just raw imported/added words)
        # Real linguistic retention thresholds:
        if words_mastered >= 2500:
            estimated_level, next_level, target_for_next, current_base = "C2", "C2+", 3500, 2500
        elif words_mastered >= 1500:
            estimated_level, next_level, target_for_next, current_base = "C1", "C2", 2500, 1500
        elif words_mastered >= 700:
            estimated_level, next_level, target_for_next, current_base = "B2", "C1", 1500, 700
        elif words_mastered >= 300:
            estimated_level, next_level, target_for_next, current_base = "B1", "B2", 700, 300
        elif words_mastered >= 100:
            estimated_level, next_level, target_for_next, current_base = "A2", "B1", 300, 100
        else:
            estimated_level, next_level, target_for_next, current_base = "A1", "A2", 100, 0

        # Calculate progress percent towards next level based on mastered words
        needed = target_for_next - current_base
        achieved = max(0, words_mastered - current_base)
        progress_pct = (
            round(min(100.0, max(0.0, (achieved / needed) * 100.0)), 1)
            if needed > 0 and words_mastered > 0
            else 0.0
        )
        words_to_next = max(0, target_for_next - words_mastered)

        if words_mastered >= 300:
            confidence = 0.85
        elif words_mastered >= 50:
            confidence = 0.70
        else:
            confidence = max(0.2, round(words_mastered / 50.0, 2))

        recs = [
            f"Sizning jami so'z boyligingiz {total_words} ta so'zdan iborat.",
            f"Hozirgi baholangan darajangiz: {estimated_level} ({progress_pct}% erishildi).",
            f"Keyingi {next_level} darajasiga erishish uchun yana {words_to_next} ta yangi so'z o'rganing.",
        ]

        # 4. Learning pace and future milestone forecasting
        settings_stmt = select(UserSettings).where(UserSettings.user_id == user_id)
        settings_obj = (await db.execute(settings_stmt)).scalars().first()
        configured_goal = settings_obj.daily_words_goal if settings_obj else 10

        today = utc_now().date()
        seven_days_ago = today - timedelta(days=6)
        recent_act_stmt = select(func.sum(DailyActivity.words_learned)).where(
            DailyActivity.user_id == user_id,
            DailyActivity.activity_date >= seven_days_ago,
        )
        recent_words_learned = (await db.execute(recent_act_stmt)).scalar() or 0
        if recent_words_learned > 0:
            daily_pace = round(max(3.0, recent_words_learned / 7.0), 1)
        else:
            daily_pace = float(max(5, configured_goal))

        cefr_targets = [
            ("A2", 150),
            ("B1", 400),
            ("B2", 900),
            ("C1", 1800),
            ("C2", 3500),
        ]

        milestones = []
        found_in_progress = False
        next_milestone_months = 0.0
        next_milestone_days = 0
        next_milestone_name = ""

        for lvl, target in cefr_targets:
            is_achieved = total_words >= target
            words_rem = max(0, target - total_words)
            days_rem = math.ceil(words_rem / daily_pace) if words_rem > 0 else 0
            months_rem = round(days_rem / 30.0, 1)
            proj_date = (today + timedelta(days=days_rem)).strftime("%Y-%m-%d")

            if is_achieved:
                status = "completed"
            elif not found_in_progress:
                status = "in_progress"
                found_in_progress = True
                next_milestone_months = months_rem
                next_milestone_days = days_rem
                next_milestone_name = lvl
            else:
                status = "upcoming"

            milestones.append(
                CefrMilestoneOut(
                    level=lvl,
                    target_words=target,
                    words_remaining=words_rem,
                    days_remaining=days_rem,
                    months_remaining=months_rem,
                    projected_date=proj_date,
                    is_achieved=is_achieved,
                    status=status,
                )
            )

        if next_milestone_name:
            forecast_summary = (
                f"Kuniga o'rtacha {daily_pace:g} ta so'z o'rganish tezligi bilan "
                f"{next_milestone_name} darajasiga {next_milestone_months} oyda "
                f"({next_milestone_days} kunda) yetishingiz kutilmoqda."
            )
        else:
            forecast_summary = "Tabriklaymiz! Siz C2 darajasiga belgilangan barcha so'z marralariga yetdingiz! 🚀"

        return LevelAssessmentOut(
            estimated_cefr_level=estimated_level,
            confidence_score=confidence,
            total_vocabulary_count=total_words,
            level_breakdown=breakdown,
            assessed_at=utc_now(),
            recommendations=recs,
            next_cefr_level=next_level,
            progress_percent=progress_pct,
            words_to_next_level=words_to_next,
            words_mastered=words_mastered,
            daily_learning_pace=daily_pace,
            milestones=milestones,
            forecast_summary=forecast_summary,
        )

    async def get_activity_heatmap(
        self,
        user_id: uuid.UUID,
        days_count: int,
        db: AsyncSession,
    ) -> ActivityHeatmapOut:
        today = utc_now().date()
        start_date = today - timedelta(days=days_count)

        # 1. Fetch DailyActivity rows
        act_stmt = select(DailyActivity).where(
            DailyActivity.user_id == user_id,
            DailyActivity.activity_date >= start_date,
            DailyActivity.activity_date <= today,
        )
        act_rows = (await db.execute(act_stmt)).scalars().all()
        act_map = {row.activity_date: row for row in act_rows}

        # 2. Fetch WordReview counts by date
        review_stmt = select(
            func.date(WordReview.created_at).label("rev_date"),
            func.count(WordReview.id).label("rev_count"),
        ).where(
            WordReview.user_id == user_id,
            WordReview.created_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc),
        ).group_by("rev_date")
        review_rows = (await db.execute(review_stmt)).all()
        review_map = {str(r.rev_date): r.rev_count for r in review_rows}

        # 3. Fetch StudySession count & minutes by date
        session_stmt = select(
            func.date(StudySession.started_at).label("sess_date"),
            func.count(StudySession.id).label("sess_count"),
            func.sum(StudySession.active_duration_seconds).label("total_sec"),
        ).where(
            StudySession.user_id == user_id,
            StudySession.started_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc),
        ).group_by("sess_date")
        session_rows = (await db.execute(session_stmt)).all()
        session_map = {
            str(r.sess_date): (r.sess_count, (r.total_sec or 0) // 60) for r in session_rows
        }

        days_list = []
        total_active_days = 0
        total_contributions = 0
        running_streak = 0
        longest_streak = 0

        for i in range(days_count + 1):
            d = start_date + timedelta(days=i)
            d_str = d.isoformat()

            act = act_map.get(d)
            act_words_learned = act.words_learned if act else 0
            act_words_reviewed = act.words_reviewed if act else 0
            act_minutes = (act.total_active_seconds // 60) if act else 0

            # Merge with review table
            raw_reviews = review_map.get(d_str, 0)
            words_reviewed = max(act_words_reviewed, raw_reviews)

            # Merge with session table
            sess_info = session_map.get(d_str, (0, 0))
            sess_count = sess_info[0]
            sess_minutes = sess_info[1]
            active_minutes = max(act_minutes, sess_minutes)

            total_count = act_words_learned + words_reviewed + sess_count

            # Calculate GitHub intensity level (0 to 4)
            if total_count == 0 and active_minutes == 0:
                level = 0
            else:
                score = total_count + (active_minutes // 5)
                if score >= 30:
                    level = 4
                elif score >= 15:
                    level = 3
                elif score >= 5:
                    level = 2
                else:
                    level = 1

            if level > 0:
                total_active_days += 1
                total_contributions += total_count
                running_streak += 1
                if running_streak > longest_streak:
                    longest_streak = running_streak
            else:
                running_streak = 0

            days_list.append(
                ActivityHeatmapDay(
                    date=d_str,
                    count=total_count,
                    words_learned=act_words_learned,
                    words_reviewed=words_reviewed,
                    active_minutes=active_minutes,
                    level=level,
                )
            )

        # Current streak ending today or yesterday
        current_streak = 0
        if days_list and days_list[-1].level > 0:
            check_idx = len(days_list) - 1
            while check_idx >= 0 and days_list[check_idx].level > 0:
                current_streak += 1
                check_idx -= 1
        elif len(days_list) > 1 and days_list[-2].level > 0:
            check_idx = len(days_list) - 2
            while check_idx >= 0 and days_list[check_idx].level > 0:
                current_streak += 1
                check_idx -= 1

        return ActivityHeatmapOut(
            total_active_days=total_active_days,
            current_streak=current_streak,
            longest_streak=longest_streak,
            total_contributions=total_contributions,
            days=days_list,
        )


analytics_service = AnalyticsService()
