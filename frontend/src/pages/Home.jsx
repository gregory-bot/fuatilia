import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Banknote, BellRing, Brain, Building2, Footprints, HandHeart, HeartHandshake, Landmark, MapPin, Microscope, PlayCircle, ShieldCheck, Smartphone, Stethoscope } from 'lucide-react'
import { api } from '../lib/api.js'
import { kes } from '../lib/format.js'
import { useI18n } from '../lib/i18n.jsx'
import Film from '../components/film/Film.jsx'
import DialingPhone from '../components/DialingPhone.jsx'

const SLIDE_MS = 12000

// Landing-page copy. Kept here (not in i18n.jsx) because it is long-form and page-specific.
const COPY = {
  en: {
    title: 'Screened is not enough. Every woman deserves treatment.',
    sub: 'We make sure women who screen positive for cervical cancer in Kenya reach treatment.',
    ctaFilm: "Watch Amina's story",
    ctaPlatform: 'Explore the platform',
    stats: [
      ['31.5%', 'of women lost to follow-up after screening in one western Kenya programme'],
      ['49.3%', 'lost between biopsy and LEEP treatment in the same programme'],
      ['1 : 1M', 'pathologists to people in Africa, against 1 : 15,000 in the US and UK'],
      ['71 days', 'median wait from biopsy to report for unpaid samples in Malawi'],
    ],
    problemEyebrow: 'The problem',
    problemTitle: 'We don’t only lose women because we fail to find them. We lose them after we find them.',
    leaks: [
      ['Women drop out after a positive screen', 'Cervical cancer is preventable, yet it is the leading cause of cancer death among women in sub-Saharan Africa. In Ethiopia, only 34.8% of treated women returned for rescreening. The reasons were lack of time, forgotten appointments, visiting another facility and pregnancy. These are coordination problems, not medical ones.'],
      ['Diagnosis takes too long', 'Africa averages about one pathologist per million people. At current training rates it would take around 400 years to reach US and UK levels. We cannot hire our way out of this, so each pathologist must be able to reach more patients.'],
    ],
    solutionEyebrow: 'Our solution',
    solutionTitle: 'An AI care navigator, built for the phones women already have.',
    layers: [
      ['Predict who will drop out', 'At the screening visit, a simple model scores each woman’s risk of being lost, using distance, age, past missed visits and phone access. High-risk women get extra support from day one, instead of being chased after they vanish.'],
      ['Remove the reasons people drop out', 'SMS and USSD in Kiswahili and English that work on any phone. A community health promoter for every high-risk woman. An M-Pesa transport refund released the moment she checks in at the treatment site.'],
      ['Speed up diagnosis', 'Biopsy slides photographed with a smartphone on a microscope are triaged by AI, so the scarce pathologist sees the most urgent cases first. A remote pathologist confirms every case. AI supports, never replaces.'],
    ],
    stepsTitle: 'How it works for one woman',
    steps: [
      ['Screened', 'VIA or HPV positive at her local dispensary.'],
      ['Scored', 'Dropout risk and the reasons, in seconds.'],
      ['Reminded', 'Kiswahili SMS and *384*12# on any phone.'],
      ['Visited', 'Her health promoter plans the journey with her.'],
      ['Refunded', 'M-Pesa fare is paid when she checks in.'],
      ['Treated', 'And reminded to rescreen in 12 months.'],
    ],
    filmEyebrow: 'The film',
    filmTitle: 'Follow Amina from Samburu to treatment',
    filmSub: 'A two-minute narrated story. Every screen you see on her phone comes from the live platform.',
    liveEyebrow: 'Live from the platform',
    liveTitle: 'One number we can move and show.',
    liveSub: 'The share of screen-positive women who complete treatment. Figures below come from the running demo (synthetic data).',
    live: ['Treatment completion', 'Women in navigation now', 'Transport refunds paid via M-Pesa', 'Average days to treatment'],
    seeImpact: 'See the impact model',
    openDashboard: 'Open the clinic dashboard',
    aboutEyebrow: 'About Fuatilia',
    aboutTitle: 'Built in Kenya, for the women we are losing.',
    about: [
      'Fuatilia is Kiswahili for “follow up”. We build on Africa’s strengths: mobile money, community health promoters and the phone already in almost every home, instead of expensive hardware.',
      'We start with cervical cancer in Samburu and Baringo, where distances are longest, then expand to breast cancer. Our work builds on proven foundations: Kenya’s CATSystem showed that women enrolled in a tracking tool were more likely to receive adequate follow-up after a positive screen.',
    ],
    aboutPoints: ['Kiswahili-first, works on feature phones', 'Privacy by design under Kenya’s Data Protection Act, 2019', 'Clinicians and pathologists stay in control'],
    whoTitle: 'Who it serves',
    who: [
      ['Ministries of Health & counties', 'A live view of every screen-positive woman and where she is in the pathway.'],
      ['Insurers (SHA-style schemes)', 'Higher completion means earlier, cheaper treatment and fewer late-stage cases.'],
      ['NGOs running screening', 'Turn screening numbers into treatment numbers, with an audit trail.'],
      ['Donors & funders', 'Pay for outcomes: transport refunds released only when a woman arrives.'],
    ],
    ctaTitle: 'Help every woman finish her care.',
    ctaSub: 'Partner with us to bring Fuatilia to more counties.',
  },
  sw: {
    title: 'Kupimwa hakutoshi. Kila mwanamke anastahili matibabu.',
    sub: 'Tunahakikisha wanawake wenye kipimo chanya cha saratani ya mlango wa kizazi nchini Kenya wanafikia matibabu.',
    ctaFilm: 'Tazama hadithi ya Amina',
    ctaPlatform: 'Gundua jukwaa',
    stats: [
      ['31.5%', 'ya wanawake walipotea baada ya uchunguzi katika mpango mmoja wa magharibi mwa Kenya'],
      ['49.3%', 'walipotea kati ya biopsy na matibabu ya LEEP katika mpango huo huo'],
      ['1 : 1M', 'wataalamu wa patholojia kwa watu barani Afrika, ikilinganishwa na 1 : 15,000 Marekani na Uingereza'],
      ['Siku 71', 'wastani wa kusubiri kutoka biopsy hadi ripoti kwa sampuli zisizolipiwa nchini Malawi'],
    ],
    problemEyebrow: 'Changamoto',
    problemTitle: 'Hatupotezi wanawake kwa sababu tu tunashindwa kuwapata. Tunawapoteza baada ya kuwapata.',
    leaks: [
      ['Wanawake huacha baada ya kipimo chanya', 'Saratani ya mlango wa kizazi inaweza kuzuiwa, lakini ndiyo chanzo kikuu cha vifo vya saratani kwa wanawake kusini mwa Sahara. Nchini Ethiopia, ni 34.8% tu ya wanawake waliotibiwa waliorudi kupimwa tena. Sababu zilikuwa ukosefu wa muda, kusahau miadi, kwenda kituo kingine na ujauzito. Hizi ni changamoto za uratibu, si za kitabibu.'],
      ['Uchunguzi wa patholojia unachelewa', 'Afrika ina wastani wa mtaalamu mmoja wa patholojia kwa kila watu milioni moja. Kwa kasi ya sasa ya mafunzo, itachukua karibu miaka 400 kufikia viwango vya Marekani na Uingereza. Hatuwezi kuajiri tu; kila mtaalamu lazima aweze kuwafikia wagonjwa wengi zaidi.'],
    ],
    solutionEyebrow: 'Suluhisho letu',
    solutionTitle: 'Msaidizi wa huduma wa AI, uliojengwa kwa simu ambazo wanawake tayari wanazo.',
    layers: [
      ['Tabiri nani ataacha', 'Wakati wa uchunguzi, modeli rahisi inakadiria hatari ya kila mwanamke kupotea, kwa umbali, umri, miadi aliyokosa na aina ya simu. Walio katika hatari kubwa wanapata msaada tangu siku ya kwanza.'],
      ['Ondoa sababu za kuacha', 'SMS na USSD kwa Kiswahili na Kiingereza zinazofanya kazi kwa simu yoyote. Mhudumu wa afya wa jamii kwa kila mwanamke aliye hatarini. Nauli ya M-Pesa inarudishwa mara tu anapofika kituo cha matibabu.'],
      ['Harakisha uchunguzi', 'Picha za slaidi zilizopigwa kwa simu kwenye hadubini zinapangwa na AI, ili mtaalamu aone kesi za dharura kwanza. Mtaalamu wa patholojia anathibitisha kila kesi. AI inasaidia, haichukui nafasi.'],
    ],
    stepsTitle: 'Inavyofanya kazi kwa mwanamke mmoja',
    steps: [
      ['Amepimwa', 'VIA au HPV chanya katika zahanati ya karibu.'],
      ['Amekadiriwa', 'Hatari ya kuacha na sababu zake, kwa sekunde.'],
      ['Amekumbushwa', 'SMS ya Kiswahili na *384*12# kwa simu yoyote.'],
      ['Ametembelewa', 'Mhudumu wa afya anapanga safari pamoja naye.'],
      ['Amerudishiwa nauli', 'M-Pesa inalipwa akifika kliniki.'],
      ['Ametibiwa', 'Na anakumbushwa kupimwa tena baada ya miezi 12.'],
    ],
    filmEyebrow: 'Filamu',
    filmTitle: 'Mfuate Amina kutoka Samburu hadi matibabu',
    filmSub: 'Hadithi ya dakika mbili yenye msimulizi. Kila skrini kwenye simu yake inatoka kwenye jukwaa halisi.',
    liveEyebrow: 'Moja kwa moja kutoka jukwaa',
    liveTitle: 'Nambari moja tunayoweza kubadilisha na kuonyesha.',
    liveSub: 'Asilimia ya wanawake wenye kipimo chanya wanaokamilisha matibabu. Takwimu hizi zinatoka kwenye onyesho linaloendelea (data ya kubuni).',
    live: ['Matibabu yaliyokamilika', 'Wanaofuatiliwa sasa', 'Nauli zilizolipwa', 'Wastani wa siku hadi matibabu'],
    seeImpact: 'Angalia modeli ya matokeo',
    openDashboard: 'Fungua dashibodi ya kliniki',
    aboutEyebrow: 'Kuhusu Fuatilia',
    aboutTitle: 'Imejengwa Kenya, kwa ajili ya wanawake tunaowapoteza.',
    about: [
      'Tunajenga juu ya nguvu za Afrika: pesa za simu, wahudumu wa afya wa jamii na simu iliyopo karibu kila nyumba, badala ya vifaa vya gharama kubwa.',
      'Tunaanza na saratani ya mlango wa kizazi Samburu na Baringo, ambako umbali ni mkubwa zaidi, kisha tutapanua hadi saratani ya matiti. Kazi yetu inajenga juu ya misingi iliyothibitishwa: CATSystem ya Kenya ilionyesha kuwa wanawake waliosajiliwa walipata ufuatiliaji bora baada ya kipimo chanya.',
    ],
    aboutPoints: ['Kiswahili kwanza, inafanya kazi kwa simu za kawaida', 'Faragha tangu mwanzo chini ya Sheria ya Ulinzi wa Data, 2019', 'Madaktari na wataalamu wa patholojia wanabaki na uamuzi'],
    whoTitle: 'Tunaowahudumia',
    who: [
      ['Wizara za Afya na kaunti', 'Mtazamo wa moja kwa moja wa kila mwanamke mwenye kipimo chanya na alipo katika safari.'],
      ['Bima (kama SHA)', 'Ukamilishaji zaidi unamaanisha matibabu ya mapema, nafuu, na kesi chache za hatua za mwisho.'],
      ['Mashirika yanayoendesha uchunguzi', 'Geuza idadi ya waliopimwa kuwa idadi ya waliotibiwa, pamoja na kumbukumbu.'],
      ['Wafadhili', 'Lipa kwa matokeo: nauli inatolewa tu mwanamke anapofika.'],
    ],
    ctaTitle: 'Saidia kila mwanamke kukamilisha matibabu yake.',
    ctaSub: 'Shirikiana nasi kuileta Fuatilia katika kaunti zaidi.',
  },
}

const HERO_SLIDES = [
  { src: '/media/hero-mother.jpg', pos: 'center 30%', flip: true },
  { src: '/media/hero-mother-baby.jpg', pos: 'center 22%', flip: true },
]

const FADE_MS = 2600

function Hero({ c }) {
  const [slide, setSlide] = useState(0)
  const [prev, setPrev] = useState(null) // the slide fading out keeps moving, so nothing jumps
  useEffect(() => {
    const id = setTimeout(() => { setPrev(slide); setSlide((s) => (s + 1) % HERO_SLIDES.length) }, SLIDE_MS)
    return () => clearTimeout(id)
  }, [slide])
  useEffect(() => {
    if (prev === null) return undefined
    const id = setTimeout(() => setPrev(null), FADE_MS + 200)
    return () => clearTimeout(id)
  }, [prev])

  return (
    <section className="relative h-[100svh] max-h-[1000px] min-h-[560px] w-full overflow-hidden bg-deep">
      {HERO_SLIDES.map((s, i) => (
        // Photos are mirrored so each woman sits on the right, clear of the headline.
        <div key={s.src} className={`absolute inset-0 ${s.flip ? '-scale-x-100' : ''}`}
          style={{ opacity: i === slide ? 1 : 0, transition: `opacity ${FADE_MS}ms cubic-bezier(.45,0,.25,1)`, zIndex: i === slide ? 1 : 0 }}>
          <img src={s.src} alt="" loading={i === 0 ? 'eager' : 'lazy'}
            className={`h-full w-full object-cover ${i === slide || i === prev ? 'kenburns' : ''}`}
            style={{ objectPosition: s.pos, '--kb-from': 1.0, '--kb-to': 1.08, '--kb-dur': `${(SLIDE_MS + FADE_MS) / 1000}s`, animationTimingFunction: 'linear' }} />
        </div>
      ))}
      <div className="absolute inset-0 z-[2] bg-gradient-to-r from-[#08262A]/85 via-[#08262A]/45 to-transparent" />
      <div className="absolute inset-0 z-[2] bg-gradient-to-t from-[#08262A]/70 via-transparent to-transparent" />

      <div className="container-page relative z-[3] flex h-full flex-col justify-end pb-16 sm:pb-24">
        <h1 className="fade-up max-w-5xl text-5xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">{c.title}</h1>
        <p className="mt-6 max-w-xl text-lg text-white/90 sm:text-xl">{c.sub}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#film" className="btn-coral px-6 py-3 text-base"><PlayCircle size={20} />{c.ctaFilm}</a>
          <Link to="/dashboard" className="btn-light px-6 py-3 text-base">{c.ctaPlatform}<ArrowRight size={18} /></Link>
        </div>
      </div>
    </section>
  )
}

function SectionHead({ eyebrow, title, sub, light = false, center = false }) {
  return (
    <div className={`max-w-3xl ${center ? 'mx-auto text-center' : ''}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-bold leading-tight sm:text-4xl ${light ? 'text-white' : ''}`}>{title}</h2>
      {sub && <p className={`mt-4 text-lg leading-relaxed ${light ? 'text-white/75' : 'text-ink-muted'}`}>{sub}</p>}
    </div>
  )
}

function LiveFigures({ c }) {
  const [m, setM] = useState(null)
  useEffect(() => { api.metrics().then(setM).catch(() => setM(false)) }, [])
  if (m === false) return null
  const vals = m ? [`${m.completion_rate}%`, m.active, kes(m.vouchers_kes), m.avg_days_to_treatment] : ['…', '…', '…', '…']
  return (
    <section className="container-page mt-24">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-end">
        <SectionHead eyebrow={c.liveEyebrow} title={c.liveTitle} sub={c.liveSub} />
        <div className="grid grid-cols-2 border-l border-t border-line">
          {c.live.map((label, i) => (
            <div key={label} className={`border-b border-r border-line p-6 ${i === 0 ? 'bg-deep text-white' : 'bg-white'}`}>
              <p className={`text-3xl font-bold tabular-nums sm:text-4xl ${i === 0 ? '' : 'text-deep'}`}>{vals[i]}</p>
              <p className={`mt-1 text-sm ${i === 0 ? 'text-white/75' : 'text-ink-muted'}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/impact" className="btn-primary">{c.seeImpact}<ArrowRight size={16} /></Link>
        <Link to="/dashboard" className="btn-ghost">{c.openDashboard}</Link>
      </div>
    </section>
  )
}

export default function Home() {
  const { lang } = useI18n()
  const c = COPY[lang]
  const layerIcons = [Brain, Smartphone, Microscope]
  const stepIcons = [Stethoscope, Brain, BellRing, Footprints, Banknote, BadgeCheck]
  const whoIcons = [Landmark, ShieldCheck, HeartHandshake, HandHeart]

  return (
    <>
      <Hero c={c} />

      {/* Numbers */}
      <section className="container-page pt-14">
        <div className="grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {c.stats.map(([n, label]) => (
            <div key={n} className="border-b border-r border-line bg-white p-6">
              <p className="text-3xl font-bold text-coral">{n}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="container-page mt-24 grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHead eyebrow={c.problemEyebrow} title={c.problemTitle} />
          <div className="mt-8 grid gap-4">
            {c.leaks.map(([h, p], i) => (
              <article key={h} className="card p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-coral">0{i + 1}</p>
                <h3 className="mt-2 text-xl">{h}</h3>
                <p className="mt-2 leading-relaxed text-ink-muted">{p}</p>
              </article>
            ))}
          </div>
        </div>
        <figure className="relative">
          <img src="/media/rural-clinic.jpg" alt="Women waiting at a rural health facility while a health worker checks a patient" loading="lazy" className="aspect-[4/5] w-full rounded-[28px] object-cover" />
          <figcaption className="absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm text-deep shadow-float">
            <MapPin size={16} className="text-coral" />{lang === 'sw' ? 'Umbali, gharama na muda ndivyo vikwazo vikuu' : 'Distance, cost and time are the real barriers'}
          </figcaption>
        </figure>
      </section>

      {/* Solution */}
      <section id="solution" className="mt-24 bg-white py-20">
        <div className="container-page">
          <SectionHead eyebrow={c.solutionEyebrow} title={c.solutionTitle} />
          <div className="mt-10 grid border-l border-t border-line md:grid-cols-3">
            {c.layers.map(([h, p], i) => {
              const Icon = layerIcons[i]
              return (
                <article key={h} className="border-b border-r border-line p-8">
                  <span className="grid h-12 w-12 place-items-center bg-mint text-teal"><Icon size={22} /></span>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink-faint">{lang === 'sw' ? 'Safu' : 'Layer'} {i + 1}</p>
                  <h3 className="mt-1 text-xl">{h}</h3>
                  <p className="mt-3 leading-relaxed text-ink-muted">{p}</p>
                </article>
              )
            })}
          </div>

          <div id="how" className="mt-20 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="relative flex min-h-[560px] items-center justify-center overflow-hidden rounded-[28px] bg-deep py-10">
              <img src="/media/amina.jpg" alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-deep via-deep/30 to-transparent" />
              <div className="relative lg:scale-110"><DialingPhone loop /></div>
              <p className="absolute bottom-5 left-0 right-0 text-center text-sm font-medium text-white/90">{lang === 'sw' ? 'Anapiga *384*12# na kuthibitisha miadi yake' : 'She dials *384*12# and confirms her visit'}</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold">{c.stepsTitle}</h3>
              <ol className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2">
                {c.steps.map(([h, p], i) => {
                  const Icon = stepIcons[i]
                  return (
                    <li key={h} className="flex gap-4 bg-white p-5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center bg-deep text-white"><Icon size={18} /></span>
                      <div>
                        <p className="font-semibold text-deep">{i + 1}. {h}</p>
                        <p className="mt-0.5 text-sm text-ink-muted">{p}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Film */}
      <section id="film" className="bg-deep py-20">
        <div className="container-page">
          <SectionHead eyebrow={c.filmEyebrow} title={c.filmTitle} sub={c.filmSub} light />
          <div className="mt-10 [&_.text-ink-faint]:text-white/50"><Film /></div>
        </div>
      </section>

      <LiveFigures c={c} />

      {/* About */}
      <section id="about" className="container-page mt-24 grid gap-12 lg:grid-cols-2 lg:items-center">
        <div className="order-2 lg:order-1">
          <img src="/media/africa-collage.png" alt="Map of Africa made of photographs of African families, health workers and children" loading="lazy" className="mx-auto w-full max-w-md mix-blend-multiply" />
        </div>
        <div className="order-1 lg:order-2">
          <SectionHead eyebrow={c.aboutEyebrow} title={c.aboutTitle} />
          {c.about.map((p) => <p key={p} className="mt-4 leading-relaxed text-ink-muted">{p}</p>)}
          <ul className="mt-6 grid gap-2">
            {c.aboutPoints.map((p) => <li key={p} className="flex items-center gap-3 border border-line bg-white px-4 py-3 text-sm font-medium text-deep"><BadgeCheck size={18} className="shrink-0 text-teal" />{p}</li>)}
          </ul>
          <img src="/media/samburu-community.jpg" alt="Samburu women and children in traditional beadwork" loading="lazy" className="mt-6 aspect-[16/7] w-full rounded-[28px] object-cover object-[center_38%]" />
        </div>
      </section>

      {/* Who it serves */}
      <section className="container-page mt-24">
        <h2 className="text-3xl font-bold">{c.whoTitle}</h2>
        <div className="mt-8 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {c.who.map(([h, p], i) => {
            const Icon = whoIcons[i]
            return (
              <article key={h} className="border-b border-r border-line bg-white p-6">
                <Icon size={22} className="text-coral" />
                <h3 className="mt-4 text-lg">{h}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{p}</p>
              </article>
            )
          })}
        </div>
      </section>

      {/* Call to action */}
      <section className="container-page mt-24">
        <div className="relative overflow-hidden rounded-[28px] bg-coral px-6 py-14 text-center sm:px-12">
          <Building2 size={120} className="absolute -right-6 -top-6 text-white/10" aria-hidden />
          <h2 className="mx-auto max-w-2xl text-3xl font-bold text-white sm:text-4xl">{c.ctaTitle}</h2>
          <p className="mt-3 text-white/90">{c.ctaSub}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#film" className="btn bg-white px-6 py-3 text-deep hover:bg-ivory"><PlayCircle size={18} />{c.ctaFilm}</a>
            <Link to="/dashboard" className="btn-light px-6 py-3">{c.openDashboard}<ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>
    </>
  )
}
