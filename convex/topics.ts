import { mutation, query } from "./_generated/server";

const todayUtc = () => new Date().toISOString().slice(0, 10);

const sampleTopics = [
  {
    category: "politics",
    question: "Should the voting age be lowered to 16 in national elections?",
    sideA: "Lower it to 16",
    sideB: "Keep it at 18",
    brief:
      "A handful of countries, including Austria and Brazil, let 16-year-olds vote, and some U.S. cities allow it in local elections. Proposals to lower the national voting age come up regularly in legislatures.",
    sideAView:
      "Sixteen-year-olds work, pay taxes, and live with the long-term effects of policy. Voting earlier may build a lifelong habit, and evidence from Austria suggests young voters are no less informed than older first-time voters.",
    sideBView:
      "Eighteen is the age of legal adulthood for most rights and responsibilities. Many 16-year-olds still live under parental influence, and consistency across adult rights keeps the law simple and predictable.",
    sources: [
      "https://www.idea.int/data-tools/data/voter-turnout-database",
      "https://www.pewresearch.org/topic/politics-policy/",
    ],
  },
  {
    category: "tech",
    question: "Should social media platforms be required to verify users' ages?",
    sideA: "Require age verification",
    sideB: "Don't require it",
    brief:
      "Several states and countries have passed or proposed laws requiring platforms to confirm users' ages, often to restrict access for minors. Methods range from ID uploads to facial age estimation.",
    sideAView:
      "Self-reported birthdays are trivially bypassed. Verification gives age limits real force and helps shield children from content and features designed for adults.",
    sideBView:
      "Verifying age usually means collecting IDs or biometric data, creating privacy and security risks for everyone. It can also lock out adults who lack ID and chill anonymous speech.",
    sources: [
      "https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy",
      "https://www.eff.org/issues/age-verification",
    ],
  },
  {
    category: "tech",
    question: "Should employers be allowed to require a full return to the office?",
    sideA: "Yes, employers decide",
    sideB: "No, keep remote options",
    brief:
      "Since 2020, many companies have shifted between remote, hybrid, and full in-office policies. Recent mandates have prompted debate about productivity, culture, and employee retention.",
    sideAView:
      "In-person work speeds collaboration, mentoring, and trust, especially for newer employees. Employers bear the costs and risks of the business, so they should set where work happens.",
    sideBView:
      "Many roles proved productive remotely, and flexibility saves commuting time and widens hiring pools. Rigid mandates can push out skilled workers who have built their lives around remote work.",
    sources: [
      "https://www.bls.gov/opub/mlr/",
      "https://wfhresearch.com/",
    ],
  },
  {
    category: "culture",
    question: "Should tipping be replaced by higher menu prices and service-included pay?",
    sideA: "Replace tipping",
    sideB: "Keep tipping",
    brief:
      "Tipping norms vary widely around the world. In the U.S., tip prompts have spread to counters and kiosks, renewing debate over whether service should simply be included in prices.",
    sideAView:
      "Tips make pay unpredictable and can reflect customer bias more than service quality. Including service in prices is more transparent and gives workers stable wages.",
    sideBView:
      "Tipping lets customers reward good service directly, and many servers earn more under it than they would from a flat wage. Higher menu prices could also reduce demand.",
    sources: [
      "https://www.dol.gov/agencies/whd/flsa/tips",
      "https://www.pewresearch.org/social-trends/",
    ],
  },
];

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const day = todayUtc();
    const existing = await ctx.db
      .query("topics")
      .withIndex("by_day", (q) => q.eq("day", day))
      .first();
    if (existing) return { inserted: 0, day };
    for (const topic of sampleTopics) {
      await ctx.db.insert("topics", { ...topic, day, hidden: false });
    }
    return { inserted: sampleTopics.length, day };
  },
});

export const today = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("topics")
      .withIndex("by_day", (q) => q.eq("day", todayUtc()))
      .filter((q) => q.eq(q.field("hidden"), false))
      .collect();
  },
});
