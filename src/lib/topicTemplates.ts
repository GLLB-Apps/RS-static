// Starting points for new topics ("ämnesområden"). Picking a template in the
// admin pre-fills the title, intro, icon and a content skeleton so a new topic
// doesn't start from a blank page. Icons are Lucide names (see lib/lucide).
import type { ContentBlock } from './types'

export interface TopicTemplate {
  key: string
  name: string          // label in the template picker
  description: string   // short helper under the name
  icon: string          // Lucide icon name ('' = none)
  title: string
  intro: string
  content: ContentBlock[]
}

// A shared skeleton so every template has the same, easy-to-fill structure.
function skeleton(opts: {
  lead: string
  about: string
  fact: string
  watch: string[]
}): ContentBlock[] {
  return [
    { type: 'paragraph', text: opts.lead },
    { type: 'heading', text: 'Vad handlar det om?' },
    { type: 'paragraph', text: opts.about },
    { type: 'factbox', title: 'Kort fakta', text: opts.fact },
    { type: 'heading', text: 'Frågor att bevaka' },
    ...opts.watch.map((q): ContentBlock => ({ type: 'paragraph', text: `• ${q}` })),
    { type: 'sources', sources: [] },
  ]
}

export const TOPIC_TEMPLATES: TopicTemplate[] = [
  {
    key: 'blank',
    name: 'Tom mall',
    description: 'Börja från ett tomt ämne.',
    icon: '',
    title: '',
    intro: '',
    content: [],
  },
  {
    key: 'natur',
    name: 'Naturvärden',
    description: 'Skog, arter och biologisk mångfald.',
    icon: 'leaf',
    title: 'Naturvärden',
    intro: 'Vilka naturvärden finns i området och hur kan de påverkas av en bergtäkt?',
    content: skeleton({
      lead: 'Rögleskogen rymmer naturmiljöer som kan påverkas av en bergtäkt. Här samlar vi vad som är känt om områdets naturvärden.',
      about: 'Beskriv skogstyp, skyddsvärda arter, våtmarker och andra naturvärden som berörs. Ange gärna om det finns nyckelbiotoper eller skyddade områden i närheten.',
      fact: 'Sammanfatta de viktigaste naturvärdena i punktform här.',
      watch: [
        'Vilka skyddade eller rödlistade arter finns i området?',
        'Hur påverkas spridningssamband och grön infrastruktur?',
        'Vilka naturvärdesinventeringar har gjorts – och av vem?',
      ],
    }),
  },
  {
    key: 'buller',
    name: 'Buller och ljud',
    description: 'Ljudnivåer från täkt och transporter.',
    icon: 'volume-2',
    title: 'Buller och ljud',
    intro: 'Hur mycket buller kan en bergtäkt ge upphov till, och vem påverkas?',
    content: skeleton({
      lead: 'Sprängningar, krossning och transporter kan ge upphov till buller. Här beskriver vi de ljudkällor som är aktuella.',
      about: 'Redogör för ljudkällor (sprängning, krossverk, lastbilar), riktvärden för buller och vilka bostäder som ligger inom påverkansavstånd.',
      fact: 'Ange kända eller uppskattade ljudnivåer och gällande riktvärden här.',
      watch: [
        'Vilka bullerriktvärden gäller vid närmaste bostäder?',
        'Hur ofta och när på dygnet sker sprängning och krossning?',
        'Finns bullerutredning – och hur är den gjord?',
      ],
    }),
  },
  {
    key: 'trafik',
    name: 'Trafik och transporter',
    description: 'Tunga transporter och vägar.',
    icon: 'truck',
    title: 'Trafik och transporter',
    intro: 'Hur påverkar täktens transporter vägar, trafiksäkerhet och närmiljö?',
    content: skeleton({
      lead: 'En bergtäkt genererar tunga transporter. Här samlar vi frågor om trafikmängd, vägar och säkerhet.',
      about: 'Beskriv förväntad mängd lastbilstransporter, vilka vägar som används, och påverkan på trafiksäkerhet, framkomlighet och vägslitage.',
      fact: 'Ange uppskattat antal transporter per dag och berörda vägar här.',
      watch: [
        'Hur många tunga transporter per dygn planeras?',
        'Vilka vägar och korsningar påverkas mest?',
        'Hur påverkas oskyddade trafikanter, t.ex. skolbarn?',
      ],
    }),
  },
  {
    key: 'damm',
    name: 'Damm och luft',
    description: 'Damm, partiklar och luftkvalitet.',
    icon: 'wind',
    title: 'Damm och luftkvalitet',
    intro: 'Hur påverkas luftkvaliteten av damm från brytning och transporter?',
    content: skeleton({
      lead: 'Brytning, krossning och transporter kan sprida damm och partiklar. Här beskriver vi luftfrågorna.',
      about: 'Redogör för dammkällor, partiklar (PM10), spridning vid olika vindriktningar och möjlig påverkan på hälsa och närmiljö.',
      fact: 'Ange kända partikelnivåer och riktvärden för luftkvalitet här.',
      watch: [
        'Hur långt kan damm spridas vid olika väder?',
        'Vilka dammbegränsande åtgärder planeras?',
        'Hur mäts och redovisas luftkvaliteten över tid?',
      ],
    }),
  },
  {
    key: 'vatten',
    name: 'Vatten och grundvatten',
    description: 'Grundvatten, brunnar och vattendrag.',
    icon: 'droplets',
    title: 'Vatten och grundvatten',
    intro: 'Hur kan en bergtäkt påverka grundvatten, brunnar och vattendrag?',
    content: skeleton({
      lead: 'Täktverksamhet kan påverka grundvattennivåer och vattenkvalitet. Här samlar vi vattenfrågorna.',
      about: 'Beskriv grundvattenförhållanden, enskilda brunnar i närheten, risk för sänkta nivåer eller förorening samt påverkan på närliggande vattendrag och våtmarker.',
      fact: 'Ange kända grundvattenförhållanden och berörda brunnar här.',
      watch: [
        'Hur många enskilda brunnar finns inom påverkansområdet?',
        'Kan grundvattennivån sänkas – och hur mycket?',
        'Hur skyddas vattenkvaliteten under och efter brytning?',
      ],
    }),
  },
]

export const topicTemplateByKey = (key: string) => TOPIC_TEMPLATES.find(t => t.key === key)
