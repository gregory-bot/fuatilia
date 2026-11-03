// Script for "Amina's journey". Every photo is real (Pexels licence or supplied by the team);
// narration is spoken by the browser in a Kenyan voice where available.

export const SCENES = [
  {
    id: 'amina', img: '/media/amina.jpg', layout: 'portrait',
    place: { en: "Lodung'okwe, Samburu County", sw: "Lodung'okwe, Kaunti ya Samburu" },
    voice: {
      en: "This is Amina. She is thirty-four, a mother of three, and she lives in Lodung'okwe, in Samburu County. The hospital that can treat her is sixty-eight kilometres away, in Maralal.",
      sw: "Huyu ni Amina. Ana miaka thelathini na minne, ni mama wa watoto watatu, na anaishi Lodung'okwe, Kaunti ya Samburu. Hospitali inayoweza kumtibu iko kilomita sitini na nane, mjini Maralal.",
    },
  },
  {
    id: 'screen', img: '/media/hero-mother.jpg', step: 'register',
    kb: { from: 1.05, to: 1.18, x1: '-2%', y1: '1%' },
    place: { en: "Lodung'okwe Dispensary", sw: "Zahanati ya Lodung'okwe" },
    voice: {
      en: 'At her local dispensary, a nurse screens her for cervical cancer. The result is positive. In that same moment, Fuatilia scores her risk of dropping out of care, and flags her as high risk.',
      sw: 'Katika zahanati ya karibu, muuguzi anampima saratani ya mlango wa kizazi. Matokeo ni chanya. Wakati huo huo, Fuatilia inakadiria hatari yake ya kuacha matibabu, na kumweka katika kundi la hatari kubwa.',
    },
  },
  {
    // Phone scenes: the Safaricom handset is the picture, over a softened photo of Amina.
    id: 'sms', img: '/media/amina.jpg', layout: 'phone', step: 'sms',
    place: { en: 'Home, that afternoon', sw: 'Nyumbani, mchana huo' },
    voice: {
      en: 'Minutes later, her phone buzzes. A message in Kiswahili tells her where and when to go. It never says the word cancer, because in many homes, phones are shared.',
      sw: 'Dakika chache baadaye, simu yake inalia. Ujumbe kwa Kiswahili unamweleza aende wapi na lini. Haitaji neno saratani, kwa sababu katika nyumba nyingi, simu hutumiwa na wengi.',
    },
  },
  {
    id: 'ussd', img: '/media/amina.jpg', layout: 'phone', step: 'ussd',
    place: { en: 'Dialling *384*12#', sw: 'Anapiga *384*12#' },
    voice: {
      en: 'She has no smartphone and no data bundle. She simply dials star, three, eight, four, star, twelve, hash, and confirms her visit in two key presses.',
      sw: 'Hana simu janja wala bando. Anapiga nyota, tatu, nane, nne, nyota, kumi na mbili, reli, na kuthibitisha miadi yake kwa vibonyezo viwili.',
    },
  },
  {
    id: 'chp', img: '/media/rural-clinic.jpg', step: 'chp',
    kb: { from: 1.04, to: 1.15, x1: '2%' },
    place: { en: 'A visit from Grace', sw: 'Ziara ya Grace' },
    voice: {
      en: 'Because she is high risk, Grace, her community health promoter, is alerted. Grace visits Amina, answers her questions, and they plan the journey together.',
      sw: 'Kwa sababu yuko katika hatari kubwa, Grace, mhudumu wake wa afya wa jamii, anajulishwa. Grace anamtembelea Amina, anajibu maswali yake, na wanapanga safari pamoja.',
    },
  },
  {
    // Two shots: Amina on board, then the matatu on the highway.
    id: 'travel', img: '/media/matatu-kenya.jpg',
    shots: [
      { img: '/media/boarding.jpg', ms: 3200, pos: 'center 62%', kb: { from: 1.08, to: 1.16, y1: '1%' } },
      { img: '/media/matatu-kenya.jpg', pos: 'center 45%', kb: { from: 1.02, to: 1.1, x1: '-2%' } },
    ],
    place: { en: 'The road to Maralal · 68 km', sw: 'Barabara ya Maralal · km 68' },
    voice: {
      en: 'On the day, Amina takes a matatu to Maralal. For many women, the fare alone is the reason they never arrive.',
      sw: 'Siku ikifika, Amina anapanda matatu kwenda Maralal. Kwa wanawake wengi, nauli pekee ndiyo sababu hawafiki kamwe.',
    },
  },
  {
    // She has arrived: a health worker checks her in. M-Pesa phone sits top-left, clear of her.
    id: 'checkin', img: '/media/hospital-checkin.jpg', step: 'checkin', overlayLeft: true, pos: 'center 22%',
    kb: { from: 1.03, to: 1.12, x1: '-2%' },
    place: { en: 'Samburu County Referral Hospital', sw: 'Hospitali ya Rufaa ya Kaunti ya Samburu' },
    voice: {
      en: 'Amina arrives at the hospital. The moment she checks in, her fare is refunded through M-Pesa. No waiting, and no claim to make.',
      sw: 'Amina anafika hospitalini. Mara tu anaposajiliwa, nauli yake inarudishwa kupitia M-Pesa. Hakuna kusubiri, wala madai ya kujaza.',
    },
  },
  {
    id: 'treated', img: '/media/hero-mother-baby.jpg', step: 'treat',
    kb: { from: 1.04, to: 1.14, x1: '-2%' },
    place: { en: 'Treated', sw: 'Ametibiwa' },
    voice: {
      en: 'Amina is treated that same week. She goes home to her children, and Fuatilia will remind her to come back for a check in twelve months.',
      sw: 'Amina anatibiwa wiki hiyo hiyo. Anarudi nyumbani kwa watoto wake, na Fuatilia itamkumbusha kurudi kupimwa baada ya miezi kumi na miwili.',
    },
  },
  {
    id: 'end', img: '/media/samburu-community.jpg',
    kb: { from: 1.02, to: 1.12 },
    place: { en: 'Fuatilia', sw: 'Fuatilia' },
    voice: {
      en: "Africa doesn't only lose cancer patients because we fail to find them. We lose them after we find them. Fuatilia makes sure every woman who screens positive gets treated.",
      sw: 'Afrika haipotezi wagonjwa wa saratani kwa sababu tu tunashindwa kuwapata. Tunawapoteza baada ya kuwapata. Fuatilia inahakikisha kila mwanamke mwenye kipimo chanya anatibiwa.',
    },
  },
]

// Shown if the API is unreachable, so the film still plays on any laptop.
export const FALLBACK = {
  patient: {
    id: null, name: 'Amina Lenaseiyan', code: 'FT-AMINA', status: 'Treated', risk_score: 87, risk_band: 'high', distance_km: 68,
    chp: { name: 'Grace Naeku' }, treatment_facility: 'Samburu County Referral Hospital, Maralal',
    risk_factors: [
      { feature: 'distance_km', en: 'Lives 68 km from the treatment site', sw: 'Anaishi km 68 kutoka kituo cha matibabu' },
      { feature: 'missed_visits', en: 'Missed 2 previous clinic visits', sw: 'Alikosa miadi 2 ya kliniki hapo awali' },
      { feature: 'feature_phone', en: 'Uses a feature phone (SMS/USSD only)', sw: 'Anatumia simu ya kawaida (SMS/USSD pekee)' },
    ],
    messages: [
      { purpose: 'intro', body: "Habari Amina, ni Lodung'okwe Dispensary. Uchunguzi wako unahitaji ziara ya ufuatiliaji Maralal Hospital tarehe 13 Novemba. Piga *384*12# kuthibitisha. Bure." },
      { purpose: 'voucher', body: '[MFANO WA M-PESA] SKB3XQ7T9M Imethibitishwa. Umepokea Ksh1,500.00 kutoka FUATILIA USAFIRI. Karibu, Amina.' },
    ],
    events: [{ kind: 'chp_visit', title: 'Home visit by Grace Naeku', detail: 'Planned the trip to Maralal; her sister will travel with her.' }],
    vouchers: [{ amount_kes: 1500, transaction_id: 'SKB3XQ7T9M', mode: 'simulated' }],
  },
  ussd: {
    menu: 'Fuatilia: Habari Amina\n1. Thibitisha miadi (13 Novemba)\n2. Badilisha tarehe\n3. Tafuta kituo cha matibabu\n4. Nipigie (mhudumu wa afya)\n5. English',
    confirm: 'Asante Amina. Miadi yako ya 13 Novemba Maralal Hospital imethibitishwa. Nauli ya M-Pesa itatumwa ukifika.',
  },
}
