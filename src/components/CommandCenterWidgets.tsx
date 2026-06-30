import React from 'react';
import { 
  FileText, 
  ShieldAlert, 
  MapPin, 
  Database,
  Clock,
  Radio,
  UserCheck,
  Building,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface CommandCenterKPIProps {
  lang: 'en' | 'kn';
  totalFIRsCount: number;
  activeAlertsCount: number;
  highRiskHotspotsCount: number;
  totalAccused?: number;
  districtCount?: number;
  stationCount?: number;
}

export const CommandCenterKPI: React.FC<CommandCenterKPIProps> = ({
  lang,
  totalFIRsCount,
  activeAlertsCount,
  highRiskHotspotsCount,
  totalAccused = 120,
  districtCount = 39,
  stationCount = 916
}) => {
  const isKn = lang === 'kn';

  const items = [
    {
      id: 'cases',
      title: isKn ? 'ಒಟ್ಟು ದಾಖಲಾದ ಪ್ರಕರಣಗಳು' : 'Total Active Cases',
      value: totalFIRsCount.toString(),
      sub: isKn ? `${districtCount} ಜಿಲ್ಲೆಗಳು • ${stationCount} ಠಾಣೆಗಳು` : `${districtCount} Districts • ${stationCount} PS`,
      trend: '+4.2%',
      trendUp: true,
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      bg: 'bg-blue-50/80',
      border: 'border-blue-200'
    },
    {
      id: 'alerts',
      title: isKn ? 'ಬಾಕಿ ಉಳಿದಿರುವ ಎಚ್ಚರಿಕೆಗಳು' : 'Pending Alerts',
      value: activeAlertsCount.toString(),
      sub: isKn ? 'ತ್ವರಿತ ಕಾರ್ಯಾಚರಣೆ ಅಗತ್ಯವಿದೆ' : 'Immediate Dispatch Queue',
      trend: isKn ? 'ಲೈವ್ ಪ್ರಸಾರ' : 'Live Broadcast',
      trendUp: false,
      icon: <ShieldAlert className={`w-5 h-5 ${activeAlertsCount > 0 ? 'text-red-600 animate-pulse' : 'text-slate-500'}`} />,
      bg: activeAlertsCount > 0 ? 'bg-red-50/80' : 'bg-slate-50/80',
      border: activeAlertsCount > 0 ? 'border-red-200' : 'border-slate-200'
    },
    {
      id: 'zones',
      title: isKn ? 'ಹೆಚ್ಚಿನ ಅಪಾಯದ ವಲಯಗಳು' : 'High-Risk Zones',
      value: highRiskHotspotsCount.toString(),
      sub: isKn ? 'DBSCAN ಕ್ಲಸ್ಟರ್ ಸಾಂದ್ರತೆ' : 'DBSCAN Density Clusters',
      trend: '14 Active',
      trendUp: true,
      icon: <MapPin className="w-5 h-5 text-amber-600 animate-bounce" />,
      bg: 'bg-amber-50/80',
      border: 'border-amber-200'
    },
    {
      id: 'sync',
      title: isKn ? 'ಸಿಸ್ಟಮ್ ಸಿಂಕ್ ಸ್ಥಿತಿ' : 'System Sync Status',
      value: `${totalAccused} Acc`,
      sub: isKn ? 'ನೋಂದಾಯಿತ ಅಪರಾಧಿಗಳು' : 'Indexed Accused Dossiers',
      trend: '100% OK',
      trendUp: true,
      icon: <Database className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50/80',
      border: 'border-emerald-200'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="command-center-kpi-root">
      {items.map((item) => (
        <div 
          key={item.id} 
          className={`bg-white border ${item.border} p-4.5 rounded-xl shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-200`}
        >
          <div className="flex items-center space-x-3.5">
            <div className={`w-11 h-11 rounded-lg ${item.bg} flex items-center justify-center shrink-0 shadow-xs`}>
              {item.icon}
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold font-sans">
                {item.title}
              </div>
              <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5 tracking-tight flex items-baseline space-x-1.5">
                <span>{item.value}</span>
                {item.id === 'cases' && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                    {item.trend}
                  </span>
                )}
              </div>
              <div className="text-[10.5px] text-slate-500 mt-0.5 kn-text leading-none font-medium">
                {item.sub}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export interface TimelineEvent {
  id: string;
  time: string;
  date: string;
  titleEn: string;
  titleKn: string;
  descEn: string;
  descKn: string;
  category: 'FIR' | 'MOVEMENT' | 'COURT' | 'DISPATCH' | 'ANOMALY';
  officer: string;
  badge: string;
}

const defaultTimelineEvents: TimelineEvent[] = [
  {
    id: 'ev-1',
    time: '08:42 AM',
    date: 'Today',
    titleEn: 'New FIR Filed: Metal Theft',
    titleKn: 'ಹೊಸ ಎಫ್‌ಐಆರ್ ದಾಖಲು: ಲೋಹದ ಕಳ್ಳತನ',
    descEn: 'FIR-2026-0811 registered at Kengeri Police Station against rowdy Ramesh under Section 379 IPC.',
    descKn: 'ಸೆಕ್ಷನ್ 379 ಐಪಿಸಿ ಅಡಿಯಲ್ಲಿ ರೌಡಿ ರಮೇಶ್ ವಿರುದ್ಧ ಕೆಂಗೇರಿ ಪೊಲೀಸ್ ಠಾಣೆಯಲ್ಲಿ FIR-2026-0811 ದಾಖಲಿಸಲಾಗಿದೆ.',
    category: 'FIR',
    officer: 'S. K. Gowda',
    badge: 'KSP-8821'
  },
  {
    id: 'ev-2',
    time: '11:15 AM',
    date: 'Today',
    titleEn: 'Suspect Geolocation Ping',
    titleKn: 'ಆರೋಪಿಯ ಮೊಬೈಲ್ ಸಿಗ್ನಲ್ ಪತ್ತೆ',
    descEn: 'Cell tower triangulation matched suspect device near Peenya industrial warehouse node.',
    descKn: 'ಪೀಣ್ಯ ಕೈಗಾರಿಕಾ ಗೋದಾಮಿನ ವಲಯದಲ್ಲಿ ಆರೋಪಿಯ ಮೊಬೈಲ್ ಸಂಕೇತ ಪತ್ತೆಯಾಗಿದೆ.',
    category: 'MOVEMENT',
    officer: 'System Intel',
    badge: 'XGB-MATRIX'
  },
  {
    id: 'ev-3',
    time: '02:30 PM',
    date: 'Today',
    titleEn: 'Blue-Hawk Squad Dispatch',
    titleKn: 'ಬ್ಲೂ-ಹಾಕ್ ಗಸ್ತು ತಂಡ ರವಾನೆ',
    descEn: 'Tactical intercept unit dispatched to Peenya Route Alpha coordinates for high-probability intercept.',
    descKn: 'ಅಪರಾಧ ತಡೆಗಟ್ಟಲು ಪೀಣ್ಯ ಮಾರ್ಗ ಆಲ್ಫಾ ನಿರ್ದೇಶಾಂಕಗಳಿಗೆ ತಾಂತ್ರಿಕ ಪ್ರತಿಬಂಧಕ ಘಟಕವನ್ನು ಕಳುಹಿಸಲಾಗಿದೆ.',
    category: 'DISPATCH',
    officer: 'Dispatch Room',
    badge: 'KSP-Hawk4'
  },
  {
    id: 'ev-4',
    time: 'Yesterday',
    date: 'Yesterday',
    titleEn: 'Bail Hearing Scheduled',
    titleKn: 'ಜಾಮೀನು ವಿಚಾರಣೆ ನಿಗದಿ',
    descEn: 'Magistrate Court 4 scheduled bail petition for ACC-4109 on 25th June.',
    descKn: 'ಮ್ಯಾಜಿಸ್ಟ್ರೇಟ್ ಕೋರ್ಟ್ 4 ಜೂನ್ ೨೫ ರಂದು ACC-4109 ಗಾಗಿ ಜಾಮೀನು ಅರ್ಜಿಯನ್ನು ನಿಗದಿಪಡಿಸಿದೆ.',
    category: 'COURT',
    officer: 'Legal Desk',
    badge: 'JUD-9011'
  },
  {
    id: 'ev-5',
    time: 'Yesterday',
    date: 'Yesterday',
    titleEn: 'Crime Volume Volatility Alarm',
    titleKn: 'ಅಪರಾಧ ಪ್ರಮಾಣ ಹೆಚ್ಚಳ ಎಚ್ಚರಿಕೆ',
    descEn: 'Month-over-month crime volume in Zone 3 exceeded 15% volatile limit threshold.',
    descKn: 'ವಲಯ ೩ ರಲ್ಲಿ ತಿಂಗಳಿನಿಂದ ತಿಂಗಳ ಅಪರಾಧ ಪ್ರಮಾಣವು ೧೫% ಬಾಷ್ಪಶೀಲ ಮಿತಿ ಮೀರಿದೆ.',
    category: 'ANOMALY',
    officer: 'AI Engine',
    badge: 'DBSCAN-V2'
  }
];

interface IncidentTimelineProps {
  lang: 'en' | 'kn';
  events?: TimelineEvent[];
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({
  lang,
  events = defaultTimelineEvents,
}) => {
  const isKn = lang === 'kn';

  const getCategoryStyles = (cat: string) => {
    switch (cat) {
      case 'FIR':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dotBg: 'bg-blue-500 ring-blue-100',
          icon: <FileText className="w-3.5 h-3.5" />
        };
      case 'MOVEMENT':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          dotBg: 'bg-purple-500 ring-purple-100',
          icon: <UserCheck className="w-3.5 h-3.5" />
        };
      case 'DISPATCH':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          dotBg: 'bg-red-500 ring-red-100',
          icon: <Radio className="w-3.5 h-3.5 animate-pulse" />
        };
      case 'COURT':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dotBg: 'bg-emerald-500 ring-emerald-100',
          icon: <Building className="w-3.5 h-3.5" />
        };
      case 'ANOMALY':
      default:
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dotBg: 'bg-amber-500 ring-amber-100',
          icon: <ShieldAlert className="w-3.5 h-3.5" />
        };
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4" id="incident-timeline-widget">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-2 kn-text">
            <Clock className="w-4 h-4 text-[#1D4ED8]" />
            <span>{isKn ? 'ನೈಜ-ಸಮಯದ ಘಟನೆಯ ಟೈಮ್‌ಲೈನ್' : 'Real-Time Incident & Movement Timeline'}</span>
          </h3>
          <p className="text-[11px] text-slate-400 font-medium kn-text">
            {isKn 
              ? 'FIR ನೋಂದಣಿಗಳು, ಆರೋಪಿಗಳ ಚಲನವಲನಗಳು ಮತ್ತು ಪ್ರಮುಖ ಘಟನೆಗಳ ಕಾಲಾನುಕ್ರಮದ ಟ್ರ್ಯಾಕರ್' 
              : 'Chronological vertical index of registered files, suspect telemetry pings, and field dispatch events.'}
          </p>
        </div>
        <span className="text-[9px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold uppercase">
          {isKn ? 'ಲೈವ್ ಟ್ರ್ಯಾಕರ್' : 'LIVE TRACK'}
        </span>
      </div>

      <div className="relative pl-6 border-l-2 border-slate-100 space-y-5 py-2">
        {events.map((ev) => {
          const styles = getCategoryStyles(ev.category);
          return (
            <div key={ev.id} className="relative group text-left">
              {/* Vertical timeline node indicator */}
              <div className={`absolute -left-[32px] top-1 w-5 h-5 rounded-full ${styles.dotBg} ring-4 flex items-center justify-center text-white shadow-xs`}>
                {styles.icon}
              </div>

              {/* Event card content */}
              <div className="bg-slate-50 border border-slate-200/70 hover:border-slate-300 rounded-xl p-3.5 transition-all duration-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-[13px] font-bold text-slate-900 font-sans kn-text">
                      {isKn ? ev.titleKn : ev.titleEn}
                    </span>
                    <span className={`text-[8.5px] font-mono px-1.5 py-0.2 rounded font-bold border uppercase ${styles.bg}`}>
                      {ev.category}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 flex items-center space-x-1 font-bold">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{ev.time} ({ev.date})</span>
                  </span>
                </div>

                <p className="text-[11.5px] text-slate-600 leading-relaxed font-medium kn-text">
                  {isKn ? ev.descKn : ev.descEn}
                </p>

                <div className="flex justify-between items-center text-[9.5px] text-slate-400 font-mono border-t border-slate-150 pt-2 leading-none">
                  <span>LOGGED BY: <b className="text-slate-650">{ev.officer}</b></span>
                  <span>CREDENTIAL ID: <b className="text-slate-650">{ev.badge}</b></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
