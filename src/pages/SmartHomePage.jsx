import { useState } from "react";
import { useLang } from "../contexts/LanguageContext";
import {
  Wifi, Thermometer, Lightbulb, Camera, Lock, Speaker,
  Home, Zap, Shield, RefreshCw, Power,
  TrendingDown, CheckCircle, Sun, Moon,
  Layers, Settings, BarChart2,
  Tv, Coffee, Droplet, Briefcase, DoorOpen,
  LogOut, Globe, Mic, Radio, Smartphone,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";
import "./SmartHomePage.css";

// ─── Mock home state ───────────────────────────────────────────────────────────
const initialRooms = [
  { id: "living",   name: { mn: "Зочны өрөө",    en: "Living Room"  }, Icon: Tv,        temp: 21, target: 22, light: true,  lightPct: 80  },
  { id: "bedroom",  name: { mn: "Унтлагын өрөө", en: "Bedroom"      }, Icon: Moon,      temp: 19, target: 20, light: false, lightPct: 0   },
  { id: "kitchen",  name: { mn: "Гал тогоо",     en: "Kitchen"      }, Icon: Coffee,    temp: 22, target: 22, light: true,  lightPct: 100 },
  { id: "bathroom", name: { mn: "Угаалгын өрөө", en: "Bathroom"     }, Icon: Droplet,   temp: 23, target: 24, light: false, lightPct: 0   },
  { id: "office",   name: { mn: "Кабинет",       en: "Office"       }, Icon: Briefcase, temp: 20, target: 21, light: true,  lightPct: 60  },
  { id: "hall",     name: { mn: "Коридор",       en: "Hallway"      }, Icon: DoorOpen,  temp: 18, target: 18, light: false, lightPct: 0   },
];

const energySavings = [
  { time: "00:00", before: 1.8, after: 0.9 },
  { time: "03:00", before: 1.5, after: 0.7 },
  { time: "06:00", before: 2.2, after: 1.1 },
  { time: "09:00", before: 3.0, after: 1.4 },
  { time: "12:00", before: 2.8, after: 1.3 },
  { time: "15:00", before: 3.2, after: 1.5 },
  { time: "18:00", before: 4.0, after: 1.9 },
  { time: "21:00", before: 3.5, after: 1.7 },
];

const devices = [
  { id: 1, name: { mn: "Ухаалаг термостат",    en: "Smart Thermostat"    }, icon: Thermometer, room: { mn: "Зочны өрөө",  en: "Living Room" }, status: "on",     brand: "Nest",         color: "#f4a261" },
  { id: 2, name: { mn: "LED гэрлийн тоосго",   en: "LED Light Bulbs"     }, icon: Lightbulb,   room: { mn: "Бүх өрөө",   en: "All Rooms"   }, status: "on",     brand: "Philips Hue",  color: "#e9c46a" },
  { id: 3, name: { mn: "Хамгаалалтын камер",   en: "Security Camera"     }, icon: Camera,      room: { mn: "Гадна",      en: "Outdoor"     }, status: "on",     brand: "Arlo",         color: "#3a8fd4" },
  { id: 4, name: { mn: "Ухаалаг цоож",         en: "Smart Lock"          }, icon: Lock,        room: { mn: "Үүд",        en: "Front Door"  }, status: "locked", brand: "Yale",         color: "#2a9d8f" },
  { id: 5, name: { mn: "Ухаалаг угаалтуур",    en: "Smart Dishwasher"    }, icon: RefreshCw,   room: { mn: "Гал тогоо",  en: "Kitchen"     }, status: "idle",   brand: "Samsung",      color: "#a8c5e0" },
  { id: 6, name: { mn: "Гэрийн туслагч",       en: "Home Assistant"      }, icon: Speaker,     room: { mn: "Зочны өрөө", en: "Living Room" }, status: "on",     brand: "Google Home",  color: "#6a9bbf" },
  { id: 7, name: { mn: "Нарны хавтан",         en: "Solar Panel"         }, icon: Sun,         room: { mn: "Дээвэр",     en: "Roof"        }, status: "on",     brand: "SolarEdge",    color: "#e9c46a" },
  { id: 8, name: { mn: "Гэрийн нэвтрэх цэг",  en: "Home Gateway"        }, icon: Wifi,        room: { mn: "Бүх өрөө",   en: "All Rooms"   }, status: "on",     brand: "Eero",         color: "#1a6eb5" },
];

const scenarios = [
  { id: "away",   Icon: LogOut, name: { mn: "Гэрт хүн байхгүй",  en: "Nobody Home"     }, desc: { mn: "Халаалт бага, гэрэл унтарсан, хамгаалалт идэвхтэй",                                              en: "Low heating, lights off, security active"                                }, savings: "35%" },
  { id: "night",  Icon: Moon,   name: { mn: "Шөнийн горим",       en: "Night Mode"       }, desc: { mn: "Гэрэл унтарсан, термостат 17°C, хаалга цоожлогдсон",                                             en: "Lights off, thermostat 17°C, door locked"                               }, savings: "28%" },
  { id: "home",   Icon: Home,   name: { mn: "Гэртээ ирсэн",       en: "Coming Home"      }, desc: { mn: "Таны дуртай температур, гэрлийн тохиргоо автоматаар идэвхждэг",                                  en: "Your preferred temperature, lighting settings activate automatically"    }, savings: "15%" },
  { id: "energy", Icon: Zap,    name: { mn: "Эрчим хүч хэмнэх",  en: "Energy Saving"    }, desc: { mn: "Бүх тоног төхөөрөмжийг хамгийн бага хэрэглээнд тохируулна",                                     en: "All devices set to minimum consumption mode"                            }, savings: "40%" },
];

const integrations = [
  { name: "Home Assistant",      Logo: Home,       desc: { mn: "Дотоодоос хянах, нууцлал хамгаалалт бүхий систем",  en: "Local control system with privacy protection"         } },
  { name: "Apple HomeKit",       Logo: Smartphone, desc: { mn: "iOS төхөөрөмжтэй гүн нэгдэл",                       en: "Deep integration with iOS devices"                    } },
  { name: "Google Home",         Logo: Globe,      desc: { mn: "Google туслагч болон Android нэгдэл",                en: "Google Assistant and Android integration"             } },
  { name: "Amazon Alexa",        Logo: Mic,        desc: { mn: "Дуут тушаалаар удирдах",                             en: "Voice command control"                                } },
  { name: "Samsung SmartThings", Logo: Layers,     desc: { mn: "Samsung бүтээгдэхүүнтэй нэгдэл",                    en: "Integration with Samsung products"                    } },
  { name: "MQTT / Zigbee",       Logo: Radio,      desc: { mn: "Нээлттэй протоколоор бие даан тохируулах",           en: "Self-configure with open protocols"                   } },
];

const benefits = [
  { Icon: Lightbulb,   title: { mn: "Автомат гэрэл",       en: "Auto Lighting"       }, desc: { mn: "Хүн орлоо гарлаа мэдрэн гэрэл автоматаар асаж унтардаг",                                         en: "Lights turn on/off automatically based on occupancy detection"       }, saving: "15-20%" },
  { Icon: Thermometer, title: { mn: "Ухаалаг термостат",   en: "Smart Thermostat"    }, desc: { mn: "Танай хуваарь болон гадна цаг уурт тохируулан халаалтыг оновчтой удирдана",                    en: "Optimizes heating based on your schedule and outdoor weather"        }, saving: "20-30%" },
  { Icon: Lock,        title: { mn: "Алсын хяналт",        en: "Remote Control"      }, desc: { mn: "Гэрийг гар утасаараа дурын газраас хянах, камер харах боломжтой",                              en: "Monitor your home from anywhere via smartphone, view cameras"        }, saving: "—"      },
  { Icon: Zap,         title: { mn: "Оргил цагийн хяналт", en: "Peak Hour Control"   }, desc: { mn: "Цахилгааны оргил цагийг зайлсхийн угаалтуур, халаалтыг тохируулна",                          en: "Avoid electricity peak hours by scheduling washer and heating"       }, saving: "10-15%" },
  { Icon: Sun,         title: { mn: "Нарны эрчим хүч",     en: "Solar Energy"        }, desc: { mn: "Нарны хавтан болон Smart Home-ийн интеграц — хэрэглээний оновчлол",                           en: "Solar panel and Smart Home integration — consumption optimization"   }, saving: "30-40%" },
  { Icon: BarChart2,   title: { mn: "Бодит цагийн мэдээлэл",en: "Real-time Data"     }, desc: { mn: "Өрөө бүрийн эрчим хүчний хэрэглээг дэлгэрэнгүй хянана",                                      en: "Monitor energy consumption in detail for each room"                 }, saving: "5-10%"  },
];

const haSteps = [
  { num: 1, title: { mn: "Raspberry Pi суурилуулах",      en: "Install Raspberry Pi"       }, desc: { mn: "Home Assistant OS-г $50–80 үнэтэй Raspberry Pi 4 дээр суулгана",                     en: "Install Home Assistant OS on a $50–80 Raspberry Pi 4"              } },
  { num: 2, title: { mn: "Zigbee/Z-Wave сүлжээ",          en: "Zigbee/Z-Wave Network"      }, desc: { mn: "Хямд Zigbee чипстэй гэрэл, мэдрэгч, термостатуудыг холбоно",                        en: "Connect affordable Zigbee lights, sensors, and thermostats"        } },
  { num: 3, title: { mn: "Автоматжуулалт тохируулах",     en: "Set Up Automation"          }, desc: { mn: "YAML эсвэл GUI ашиглан дүрэм, сценари үүсгэнэ",                                     en: "Create rules and scenarios using YAML or GUI"                      } },
  { num: 4, title: { mn: "UB Energy нэгдэл",              en: "UB Energy Integration"      }, desc: { mn: "Энэ системтэй холбож барилгын эрчим хүчний хэрэглээг оновчлоно",                    en: "Connect with this system to optimize building energy consumption"   } },
];

function ToggleSwitch({ on, onChange }) {
  return (
    <button className={`toggle-sw ${on ? "on" : ""}`} onClick={onChange} role="switch" aria-checked={on}>
      <span className="toggle-thumb" />
    </button>
  );
}

function RoomCard({ room, lang, lightOffLabel, onToggleLight }) {
  const RoomIcon = room.Icon;
  return (
    <div className={`room-card ${room.light ? "lit" : ""}`}>
      <div className="room-icon">{RoomIcon && <RoomIcon size={24} />}</div>
      <div className="room-name">{room.name[lang]}</div>

      <div className="room-controls">
        <div className="room-temp-row">
          <Thermometer size={14} style={{ color: "#f4a261" }} />
          <span className="room-temp">{room.temp}°C</span>
          <span className="room-target">/ {room.target}°C</span>
        </div>

        <div className="room-light-row">
          <Lightbulb size={14} style={{ color: room.light ? "#e9c46a" : "var(--text3)" }} />
          <span style={{ fontSize: "0.8rem", color: room.light ? "var(--accent)" : "var(--text3)" }}>
            {room.light ? `${room.lightPct}%` : lightOffLabel}
          </span>
          <ToggleSwitch on={room.light} onChange={() => onToggleLight(room.id)} />
        </div>
      </div>

      {room.light && (
        <input
          type="range"
          min={10} max={100} value={room.lightPct}
          className="light-range"
          onChange={() => {}}
          style={{ accentColor: "#e9c46a" }}
        />
      )}

      <div className={`room-status-dot ${room.light ? "active" : ""}`} />
    </div>
  );
}

export default function SmartHomePage() {
  const { t, lang } = useLang();
  const [rooms, setRooms] = useState(initialRooms);
  const [devices2, setDevices2] = useState(devices);
  const [activeScenario, setActiveScenario] = useState(null);
  const [tab, setTab] = useState("overview");

  const toggleLight = (id) => {
    setRooms(r => r.map(rm => rm.id === id ? { ...rm, light: !rm.light, lightPct: rm.light ? 0 : 80 } : rm));
  };

  const toggleDevice = (id) => {
    setDevices2(d => d.map(dev => dev.id === id
      ? { ...dev, status: dev.status === "on" ? "off" : "on" }
      : dev));
  };

  const lightsOn  = rooms.filter(r => r.light).length;
  const avgTemp   = Math.round(rooms.reduce((s, r) => s + r.temp, 0) / rooms.length);
  const devicesOn = devices2.filter(d => d.status === "on").length;

  const tabs = [
    { id: "overview",  label: t.smarthome.tab_overview,  icon: Home     },
    { id: "rooms",     label: t.smarthome.tab_rooms,     icon: Layers   },
    { id: "devices",   label: t.smarthome.tab_devices,   icon: Settings },
    { id: "scenarios", label: t.smarthome.tab_scenarios, icon: Zap      },
  ];

  return (
    <div className="smarthome-page">
      {/* ─── Hero ─── */}
      <div className="sh-hero">
        <div className="sh-hero-bg" />
        <div className="container sh-hero-inner">
          <div className="sh-hero-text">
            <div className="sh-badge">
              <Wifi size={14} />
              <span>Smart Home · IoT · Home Automation</span>
            </div>
            <h1 className="sh-title">{t.smarthome.title}</h1>
            <p className="sh-subtitle">{t.smarthome.subtitle}</p>
          </div>

          {/* Live status bar */}
          <div className="sh-status-bar">
            <div className="sh-status-item">
              <Lightbulb size={18} style={{ color: "#e9c46a" }} />
              <div>
                <div className="sh-s-val">{lightsOn} / {rooms.length}</div>
                <div className="sh-s-lbl">{t.smarthome.lights_on}</div>
              </div>
            </div>
            <div className="sh-status-item">
              <Thermometer size={18} style={{ color: "#f4a261" }} />
              <div>
                <div className="sh-s-val">{avgTemp}°C</div>
                <div className="sh-s-lbl">{t.smarthome.avg_temp}</div>
              </div>
            </div>
            <div className="sh-status-item">
              <Power size={18} style={{ color: "#3a8fd4" }} />
              <div>
                <div className="sh-s-val">{devicesOn} / {devices2.length}</div>
                <div className="sh-s-lbl">{t.smarthome.devices_on}</div>
              </div>
            </div>
            <div className="sh-status-item">
              <TrendingDown size={18} style={{ color: "#2a9d8f" }} />
              <div>
                <div className="sh-s-val">-32%</div>
                <div className="sh-s-lbl">{t.smarthome.energy_saving}</div>
              </div>
            </div>
            <div className="sh-status-item">
              <Shield size={18} style={{ color: "#2a9d8f" }} />
              <div>
                <div className="sh-s-val" style={{ color: "#2a9d8f" }}>{t.smarthome.secured}</div>
                <div className="sh-s-lbl">{t.smarthome.security}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="container">
        <div className="sh-tabs mb-3">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`sh-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              <Icon size={16} />{label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="animate-fade">
            <div className="grid grid-2 mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="card">
                <h3 className="section-title" style={{ fontSize: "1rem" }}>
                  <BarChart2 size={16} style={{ marginLeft: 8 }} />
                  {t.smarthome.chart_title}
                </h3>
                <p className="sh-chart-note">{t.smarthome.chart_note}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={energySavings} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="before" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e63946" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#e63946" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="after" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2a9d8f" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#2a9d8f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,74,107,0.35)" />
                    <XAxis dataKey="time" tick={{ fill: "#6a9bbf", fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fill: "#6a9bbf", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }} formatter={(v) => [`${v} kWh`]} />
                    <Area type="monotone" dataKey="before" stroke="#e63946" fill="url(#before)" strokeWidth={2} name={t.smarthome.regular_home} />
                    <Area type="monotone" dataKey="after"  stroke="#2a9d8f" fill="url(#after)"  strokeWidth={2} name="Smart Home" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <h3 className="section-title" style={{ fontSize: "1rem" }}>
                  <CheckCircle size={16} style={{ marginLeft: 8, color: "var(--success)" }} />
                  {t.smarthome.benefits_title}
                </h3>
                <div className="benefits-list">
                  {benefits.map(b => {
                    const BIcon = b.Icon;
                    return (
                    <div key={b.title.en} className="benefit-row">
                      <span className="benefit-icon">{BIcon && <BIcon size={18} />}</span>
                      <div className="benefit-info">
                        <span className="benefit-title">{b.title[lang]}</span>
                        <span className="benefit-desc">{b.desc[lang]}</span>
                      </div>
                      {b.saving !== "—" && <span className="benefit-saving">{b.saving}</span>}
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Integrations */}
            <div className="card mb-3">
              <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.smarthome.integrations_title}</h3>
              <div className="grid grid-3">
                {integrations.map(int => {
                  const IntLogo = int.Logo;
                  return (
                    <div key={int.name} className="integration-card">
                      <span className="int-logo">{IntLogo && <IntLogo size={20} />}</span>
                      <div>
                        <div className="int-name">{int.name}</div>
                        <div className="int-desc">{int.desc[lang]}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Rooms ── */}
        {tab === "rooms" && (
          <div className="animate-fade">
            <div className="rooms-header mb-2">
              <span>{t.smarthome.rooms_hint}</span>
              <button className="btn btn-secondary" onClick={() => setRooms(r => r.map(rm => ({ ...rm, light: false, lightPct: 0 })))}>
                <Moon size={15} /> {t.smarthome.turn_off_all}
              </button>
              <button className="btn btn-accent" onClick={() => setRooms(r => r.map(rm => ({ ...rm, light: true, lightPct: 80 })))}>
                <Sun size={15} /> {t.smarthome.turn_on_all}
              </button>
            </div>
            <div className="grid grid-3">
              {rooms.map(room => (
                <RoomCard key={room.id} room={room} lang={lang} lightOffLabel={t.smarthome.light_off} onToggleLight={toggleLight} />
              ))}
            </div>
          </div>
        )}

        {/* ── Devices ── */}
        {tab === "devices" && (
          <div className="animate-fade">
            <div className="grid grid-2">
              {devices2.map(dev => {
                const Icon = dev.icon;
                const isOn = dev.status === "on" || dev.status === "locked";
                return (
                  <div key={dev.id} className={`device-card card ${isOn ? "on" : ""}`}>
                    <div className="dev-icon-wrap" style={{ background: `${dev.color}22`, color: dev.color }}>
                      <Icon size={22} />
                    </div>
                    <div className="dev-info">
                      <div className="dev-name">{dev.name[lang]}</div>
                      <div className="dev-room">{dev.room[lang]} · {dev.brand}</div>
                    </div>
                    <div className="dev-right">
                      <span className={`dev-status ${isOn ? "on" : "off"}`}>
                        {isOn ? t.smarthome.device_on : t.smarthome.device_off}
                      </span>
                      <ToggleSwitch on={isOn} onChange={() => toggleDevice(dev.id)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Scenarios ── */}
        {tab === "scenarios" && (
          <div className="animate-fade">
            <p className="sh-chart-note mb-2">{t.smarthome.scenarios_hint}</p>
            <div className="grid grid-2">
              {scenarios.map(sc => {
                const ScIcon = sc.Icon;
                return (
                <button
                  key={sc.id}
                  className={`scenario-card ${activeScenario === sc.id ? "active" : ""}`}
                  onClick={() => setActiveScenario(sc.id)}
                >
                  <div className="sc-emoji">{ScIcon && <ScIcon size={22} />}</div>
                  <div className="sc-info">
                    <div className="sc-name">{sc.name[lang]}</div>
                    <div className="sc-desc">{sc.desc[lang]}</div>
                  </div>
                  <div className="sc-saving">
                    <TrendingDown size={14} />
                    {sc.savings}
                  </div>
                  {activeScenario === sc.id && (
                    <div className="sc-active-label">
                      <CheckCircle size={14} /> {t.smarthome.active_label}
                    </div>
                  )}
                </button>
                );
              })}
            </div>

            <div className="card mt-3">
              <h3 className="section-title" style={{ fontSize: "1rem" }}>{t.smarthome.ha_title}</h3>
              <div className="ha-grid">
                {haSteps.map(step => (
                  <div key={step.num} className="ha-step">
                    <div className="ha-num">{step.num}</div>
                    <div>
                      <strong>{step.title[lang]}</strong>
                      <p>{step.desc[lang]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
