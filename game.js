// 割喉冒險隊 — 遊戲引擎（在房主的瀏覽器裡執行）
(function () {
  const MAX_HP = 60;
  const ACTION_HAND = 4;
  const START_EVENTS = 3;
  const REACT_MS = 10000;     // 反應時間窗
  const REST_HEAL = 10;       // 每場戰鬥後休息回血
  const MAX_PLAYERS = 6;

  // ───────────── 卡牌與怪物資料 ─────────────
  const ACTION_DEFS = [
    { key: 'a10', name: '攻擊 10', type: 'attack', value: 10, count: 9 },
    { key: 'a15', name: '攻擊 15', type: 'attack', value: 15, count: 8 },
    { key: 'a20', name: '攻擊 20', type: 'attack', value: 20, count: 9 },
    { key: 'a25', name: '攻擊 25', type: 'attack', value: 25, count: 7 },
    { key: 'a30', name: '攻擊 30', type: 'attack', value: 30, count: 5 },
    { key: 'a40', name: '攻擊 40', type: 'attack', value: 40, count: 3 },
    { key: 'a50', name: '致命重擊 50', type: 'attack', value: 50, count: 2 },
    { key: 'aim', name: '精準一擊 15', type: 'attack', value: 15, count: 3, desc: '若此擊殺死怪物，額外 +1 威望' },
    { key: 'miss', name: '失手 0', type: 'attack', value: 0, count: 3, desc: '什麼也沒打中……' },
    { key: 'heal', name: '包紮 +15', type: 'heal', value: 15, count: 5, desc: '回復自己 15 HP' },
    { key: 'guard', name: '防禦姿態', type: 'guard', value: 0, count: 5, desc: '本回合受到的怪物傷害減半' },
  ];

  const EVENT_DEFS = [
    { key: 'parry', name: '格擋', when: 'player', count: 6, desc: '讓一次玩家攻擊完全無效（搶殺神卡）' },
    { key: 'glance', name: '擦傷', when: 'player', count: 5, desc: '一次玩家攻擊傷害減半' },
    { key: 'empower', name: '狂怒祝福', when: 'player', count: 5, desc: '一次玩家攻擊傷害 +15' },
    { key: 'misdirect', name: '誤傷友軍', when: 'player', target: true, count: 4, desc: '一次玩家攻擊改打你指定的另一名玩家（傷害減半）' },
    { key: 'dodge', name: '翻滾閃避', when: 'monsterSelf', count: 4, desc: '躲開一次打向你的怪物攻擊' },
    { key: 'shove', name: '推人擋刀', when: 'monsterSelf', target: true, count: 4, desc: '把打向你的怪物攻擊轉移給指定玩家' },
    { key: 'curse', name: '詛咒', when: 'monster', count: 4, desc: '一次怪物攻擊傷害 +10' },
    { key: 'shield', name: '守護之盾', when: 'monster', count: 4, desc: '一次怪物攻擊傷害減半' },
    { key: 'potion', name: '治療藥水', when: 'any', count: 6, desc: '隨時回復自己 20 HP' },
    { key: 'swap', name: '搶先一步', when: 'planning', target: true, count: 4, desc: '計畫階段：與指定玩家交換先攻' },
  ];

  const ABILITY_DESC = {
    none: '',
    armor: '堅甲：每次受到玩家攻擊傷害 -5',
    regen: '再生：每回合結束回復 10 HP',
    lifesteal: '吸血：造成的傷害回復自身',
    thorns: '荊棘：攻擊它的玩家受到 5 點反傷',
    enrage: '狂暴：HP 低於一半時攻擊 +8',
  };
  const TARGET_DESC = {
    init1: '攻擊先攻 #1',
    initLast: '攻擊先攻最後一位',
    highestHp: '攻擊 HP 最高者',
    lowestHp: '攻擊 HP 最低者',
    highestPrestige: '攻擊威望最高者',
    two: '攻擊先攻 #1 與最後一位',
    all: '攻擊所有人',
  };
  const MONSTERS = [
    { name: '洞穴蝙蝠群', icon: '🦇', hp: 50, dmg: 8, target: 'initLast', prestige: 1, ability: 'none' },
    { name: '哥布林斥候', icon: '👺', hp: 60, dmg: 10, target: 'init1', prestige: 1, ability: 'none' },
    { name: '巨型蜘蛛', icon: '🕷️', hp: 70, dmg: 12, target: 'lowestHp', prestige: 2, ability: 'none' },
    { name: '骷髏戰士', icon: '💀', hp: 75, dmg: 12, target: 'init1', prestige: 2, ability: 'armor' },
    { name: '沼澤巨魔', icon: '🧌', hp: 85, dmg: 14, target: 'highestHp', prestige: 3, ability: 'regen' },
    { name: '石像鬼', icon: '🗿', hp: 80, dmg: 6, target: 'all', prestige: 3, ability: 'armor' },
    { name: '吸血鬼伯爵', icon: '🧛', hp: 95, dmg: 15, target: 'highestPrestige', prestige: 3, ability: 'lifesteal' },
    { name: '荊棘樹人', icon: '🌳', hp: 100, dmg: 12, target: 'initLast', prestige: 3, ability: 'thorns' },
    { name: '牛頭人', icon: '🐂', hp: 105, dmg: 16, target: 'init1', prestige: 4, ability: 'enrage' },
    { name: '食人魔雙子', icon: '👹', hp: 115, dmg: 12, target: 'two', prestige: 4, ability: 'none' },
    { name: '冰霜巨人', icon: '🥶', hp: 125, dmg: 16, target: 'highestHp', prestige: 4, ability: 'armor' },
  ];
  const BOSS = { name: '遠古紅龍', icon: '🐉', hp: 200, dmg: 10, target: 'all', prestige: 6, ability: 'enrage', boss: true };
  const NUM_NORMAL = 7;

  // ───────────── 工具 ─────────────
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const uid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

  // 以 _ 開頭的欄位（計時器、回呼）不存檔
  const saveReplacer = (k, v) => (k.startsWith('_') ? undefined : v);

  function createRoom(code, onChange) {
    const room = { code, players: [], hostId: null, phase: 'lobby', log: [], round: 0, cardSeq: 1, reactSeq: 0 };
    room._onChange = onChange;
    return room;
  }

  function restoreRoom(json, onChange) {
    const room = JSON.parse(json);
    room._onChange = onChange;
    for (const p of room.players) p.connected = false;
    // 恢復中斷的計時流程
    if (room.phase === 'resolve') {
      if (room.reaction) { room.reaction.passed = {}; room.reaction.deadline = Date.now() + REACT_MS; room._timer = setTimeout(() => closeReaction(room), REACT_MS); }
      else setTimeout(() => advance(room), 500);
    } else if (room.phase === 'intermission') {
      setTimeout(() => { if (room.phase === 'intermission') nextEncounter(room); }, 2000);
    }
    return room;
  }

  function serialize(room) { return JSON.stringify(room, saveReplacer); }

  function buildDeck(room, defs) {
    const d = [];
    for (const def of defs) for (let i = 0; i < def.count; i++) d.push({ ...def, id: room.cardSeq++ });
    return shuffle(d);
  }

  function log(room, msg) {
    room.log.push(msg);
    if (room.log.length > 120) room.log.shift();
  }

  function draw(room, which) {
    const deck = which === 'action' ? 'actionDeck' : 'eventDeck';
    const disc = which === 'action' ? 'actionDiscard' : 'eventDiscard';
    if (room[deck].length === 0) { room[deck] = shuffle(room[disc]); room[disc] = []; }
    return room[deck].pop();
  }

  const alivePlayers = (room) => room.players.filter((p) => p.alive);
  const byId = (room, id) => room.players.find((p) => p.id === id);
  const changed = (room) => room._onChange && room._onChange();

  function addPlayer(room, name) {
    if (room.phase !== 'lobby') return { error: '遊戲已開始，無法加入新玩家' };
    if (room.players.length >= MAX_PLAYERS) return { error: `房間已滿（最多 ${MAX_PLAYERS} 人）` };
    const p = { id: uid(), token: uid(), name: String(name || '').trim().slice(0, 12) || '冒險者', connected: false };
    room.players.push(p);
    if (!room.hostId) room.hostId = p.id;
    log(room, `👋 ${p.name} 加入了房間`);
    changed(room);
    return { player: p };
  }

  // ───────────── 遊戲流程 ─────────────
  function startGame(room) {
    room.actionDeck = buildDeck(room, ACTION_DEFS); room.actionDiscard = [];
    room.eventDeck = buildDeck(room, EVENT_DEFS); room.eventDiscard = [];
    const n = room.players.length;
    const scale = Math.max(0.75, n / 4) * 1.3;
    const normals = shuffle([...MONSTERS]).slice(0, NUM_NORMAL).sort((a, b) => a.hp - b.hp);
    room.encounters = [...normals, BOSS].map((m) => ({ ...m, maxHp: Math.round((m.hp * scale) / 5) * 5 }));
    room.encounterIdx = -1;
    room.winners = [];
    for (const p of room.players) {
      Object.assign(p, { hp: MAX_HP, prestige: 0, alive: true, actionHand: [], eventHand: [], chosen: null, init: 0, kills: [], guard: false });
      for (let i = 0; i < ACTION_HAND; i++) p.actionHand.push(draw(room, 'action'));
      for (let i = 0; i < START_EVENTS; i++) p.eventHand.push(draw(room, 'event'));
    }
    room.log = [];
    log(room, `⚔️ 冒險開始！共 ${room.encounters.length} 場遭遇，最後是 BOSS。擊殺者才能獲得威望！`);
    nextEncounter(room);
  }

  function nextEncounter(room) {
    room.encounterIdx++;
    if (room.encounterIdx >= room.encounters.length) return endGame(room);
    const m = room.encounters[room.encounterIdx];
    room.monster = { ...m, curHp: m.maxHp };
    room.round = 0;
    log(room, `━━ 遭遇 ${room.encounterIdx + 1}/${room.encounters.length}：${m.icon} ${m.name}（HP ${m.maxHp}，價值 ${m.prestige} 威望）━━`);
    startRound(room);
  }

  function startRound(room) {
    room.round++;
    room.phase = 'planning';
    room.pending = null; room.queue = []; room.reaction = null;
    const alive = alivePlayers(room);
    const inits = shuffle(alive.map((_, i) => i + 1));
    alive.forEach((p, i) => { p.init = inits[i]; p.chosen = null; p.guard = false; });
    room.players.filter((p) => !p.alive).forEach((p) => { p.init = 0; p.chosen = null; });
    log(room, `— 第 ${room.round} 回合：秘密選擇行動卡 —`);
    changed(room);
    maybeBeginResolve(room);
  }

  function allChosen(room) {
    return alivePlayers(room).every((p) => p.chosen || !p.connected);
  }

  // 全員選好（或離線）就開始結算；至少要有一位在線玩家
  function maybeBeginResolve(room) {
    if (room.phase !== 'planning' || !allChosen(room) || !alivePlayers(room).some((p) => p.connected)) return;
    clearTimeout(room._resolveTimer);
    room._resolveTimer = setTimeout(() => { if (room.phase === 'planning' && allChosen(room)) beginResolve(room); }, 800);
  }

  function beginResolve(room) {
    room.phase = 'resolve';
    // 離線玩家自動出第一張
    for (const p of alivePlayers(room)) if (!p.chosen) p.chosen = p.actionHand.shift();
    const order = alivePlayers(room).sort((a, b) => a.init - b.init);
    log(room, `🂠 翻牌！${order.map((p) => `${p.name}:${p.chosen.name}`).join('、')}`);
    room.queue = order.map((p) => ({ kind: 'player', actorId: p.id }));
    room.queue.push({ kind: 'monster' });
    advance(room);
  }

  function monsterDamage(room) {
    const m = room.monster;
    let d = m.dmg;
    if (m.ability === 'enrage' && m.curHp <= m.maxHp / 2) d += 8;
    return d;
  }

  function monsterTargets(room) {
    const alive = alivePlayers(room);
    if (!alive.length) return [];
    const byInit = [...alive].sort((a, b) => a.init - b.init);
    const pick = (arr, key, dir) => [...arr].sort((a, b) => dir * (b[key] - a[key]) || a.init - b.init)[0];
    switch (room.monster.target) {
      case 'init1': return [byInit[0]];
      case 'initLast': return [byInit[byInit.length - 1]];
      case 'highestHp': return [pick(alive, 'hp', 1)];
      case 'lowestHp': return [pick(alive, 'hp', -1)];
      case 'highestPrestige': return [pick(alive, 'prestige', 1)];
      case 'two': return byInit.length > 1 ? [byInit[0], byInit[byInit.length - 1]] : [byInit[0]];
      case 'all': return byInit;
    }
    return [byInit[0]];
  }

  function advance(room) {
    clearTimeout(room._timer);
    if (room.phase !== 'resolve') return;
    while (room.queue.length) {
      const item = room.queue.shift();
      if (item.kind === 'player') {
        const p = byId(room, item.actorId);
        if (!p || !p.alive) continue;
        const c = p.chosen;
        if (c.type === 'heal') {
          p.hp = Math.min(MAX_HP, p.hp + c.value);
          log(room, `💚 ${p.name} 包紮，回復 ${c.value} HP`);
          continue;
        }
        if (c.type === 'guard') {
          p.guard = true;
          log(room, `🛡️ ${p.name} 擺出防禦姿態`);
          continue;
        }
        room.pending = { kind: 'player', actorId: p.id, card: c, damage: c.value, target: 'monster' };
        log(room, `🗡️ ${p.name} 準備出手：${c.name}`);
        return openReaction(room);
      }
      if (item.kind === 'monster') {
        const targets = monsterTargets(room);
        const dmg = monsterDamage(room);
        room.queue.unshift(...targets.map((t) => ({ kind: 'monsterHit', targetId: t.id, damage: dmg })));
        continue;
      }
      if (item.kind === 'monsterHit') {
        const t = byId(room, item.targetId);
        if (!t || !t.alive) continue;
        room.pending = { kind: 'monster', targetId: t.id, damage: item.damage };
        log(room, `${room.monster.icon} ${room.monster.name} 撲向 ${t.name}（${item.damage} 傷害）`);
        return openReaction(room);
      }
    }
    endRound(room);
  }

  function openReaction(room) {
    room.reactSeq++;
    room.reaction = { passed: {}, deadline: Date.now() + REACT_MS, seq: room.reactSeq };
    room._timer = setTimeout(() => closeReaction(room), REACT_MS);
    changed(room);
    checkAllPassed(room);
  }

  function checkAllPassed(room) {
    if (!room.reaction) return;
    const waiting = alivePlayers(room).filter((p) => p.connected && !room.reaction.passed[p.id]);
    if (waiting.length === 0) closeReaction(room);
    else changed(room);
  }

  function closeReaction(room) {
    clearTimeout(room._timer);
    if (!room.pending) return;
    const pd = room.pending;
    room.pending = null; room.reaction = null;
    if (pd.kind === 'player') resolvePlayerAttack(room, pd);
    else resolveMonsterHit(room, pd);
    if (room.phase !== 'resolve') return; // 遭遇結束或遊戲結束
    changed(room);
    setTimeout(() => advance(room), 700);
  }

  function damagePlayer(room, p, dmg, src) {
    if (!p.alive || dmg <= 0) return;
    p.hp -= dmg;
    log(room, `💥 ${p.name} 受到 ${dmg} 傷害（${src}），剩 ${Math.max(0, p.hp)} HP`);
    if (p.hp <= 0) {
      p.hp = 0; p.alive = false;
      log(room, `☠️ ${p.name} 倒下了！`);
      room.queue = room.queue.filter((q) => q.actorId !== p.id && q.targetId !== p.id);
    }
  }

  function resolvePlayerAttack(room, pd) {
    const a = byId(room, pd.actorId);
    const m = room.monster;
    if (pd.cancelled) { log(room, `🚫 ${a.name} 的攻擊被格擋了！`); return afterDeaths(room); }
    if (pd.target !== 'monster') {
      damagePlayer(room, byId(room, pd.target), pd.damage, `${a.name} 的誤傷`);
      return afterDeaths(room);
    }
    let dmg = pd.damage;
    if (m.ability === 'armor' && dmg > 0) dmg = Math.max(0, dmg - 5);
    if (dmg <= 0) log(room, `💨 ${a.name} 沒有造成傷害`);
    else {
      m.curHp -= dmg;
      log(room, `⚔️ ${a.name} 對 ${m.name} 造成 ${dmg} 傷害（剩 ${Math.max(0, m.curHp)}）`);
    }
    if (m.curHp <= 0) {
      const gain = m.prestige + (pd.card.key === 'aim' ? 1 : 0);
      a.prestige += gain;
      a.kills.push(m.name);
      log(room, `🏆 ${a.name} 給予 ${m.name} 致命一擊！獲得 ${gain} 威望`);
      return encounterWon(room);
    }
    if (m.ability === 'thorns' && pd.damage > 0) damagePlayer(room, a, 5, '荊棘反傷');
    afterDeaths(room);
  }

  function resolveMonsterHit(room, pd) {
    const t = byId(room, pd.targetId);
    if (pd.cancelled) { log(room, `🌀 ${t.name} 躲過了攻擊！`); return afterDeaths(room); }
    let dmg = pd.damage;
    if (t.guard) dmg = Math.ceil(dmg / 2);
    const before = t.hp;
    damagePlayer(room, t, dmg, room.monster.name);
    if (room.monster.ability === 'lifesteal') {
      const healed = Math.min(before, dmg);
      room.monster.curHp = Math.min(room.monster.maxHp, room.monster.curHp + healed);
      if (healed) log(room, `🩸 ${room.monster.name} 吸血回復 ${healed}`);
    }
    afterDeaths(room);
  }

  function afterDeaths(room) {
    if (alivePlayers(room).length === 0) { log(room, '💀 全員陣亡，地城吞噬了所有冒險者……'); endGame(room); }
  }

  function encounterWon(room) {
    room.phase = 'intermission';
    room.queue = []; room.pending = null; room.reaction = null;
    for (const p of room.players) if (p.chosen) { room.actionDiscard.push(p.chosen); p.chosen = null; }
    for (const p of alivePlayers(room)) {
      p.hp = Math.min(MAX_HP, p.hp + REST_HEAL);
      while (p.actionHand.length < ACTION_HAND) p.actionHand.push(draw(room, 'action'));
      p.eventHand.push(draw(room, 'event'));
    }
    log(room, `🏕️ 稍作休息：存活者回復 ${REST_HEAL} HP 並抽 1 張事件卡`);
    changed(room);
    setTimeout(() => { if (room.phase === 'intermission') nextEncounter(room); }, 3500);
  }

  function endRound(room) {
    const m = room.monster;
    if (m.ability === 'regen' && m.curHp > 0) {
      m.curHp = Math.min(m.maxHp, m.curHp + 10);
      log(room, `🌿 ${m.name} 再生 10 HP（${m.curHp}）`);
    }
    for (const p of room.players) {
      if (p.chosen) { room.actionDiscard.push(p.chosen); p.chosen = null; }
      if (p.alive) while (p.actionHand.length < ACTION_HAND) p.actionHand.push(draw(room, 'action'));
    }
    startRound(room);
  }

  function endGame(room) {
    clearTimeout(room._timer);
    room.phase = 'gameover';
    room.pending = null; room.reaction = null;
    const alive = alivePlayers(room);
    if (alive.length) {
      const best = Math.max(...alive.map((p) => p.prestige));
      const winners = alive.filter((p) => p.prestige === best);
      room.winners = winners.map((p) => p.id);
      log(room, `👑 冒險結束！勝利者：${winners.map((p) => p.name).join('、')}（${best} 威望）`);
    } else room.winners = [];
    changed(room);
  }

  // ───────────── 事件卡 ─────────────
  function canPlay(room, p, card) {
    if (!p.alive) return false;
    const pd = room.pending;
    switch (card.when) {
      case 'any': return room.phase === 'planning' || (room.phase === 'resolve' && !!pd);
      case 'planning': return room.phase === 'planning';
      case 'player': return room.phase === 'resolve' && !!pd && pd.kind === 'player' && !pd.cancelled && pd.target === 'monster';
      case 'monster': return room.phase === 'resolve' && !!pd && pd.kind === 'monster' && !pd.cancelled;
      case 'monsterSelf': return room.phase === 'resolve' && !!pd && pd.kind === 'monster' && !pd.cancelled && pd.targetId === p.id;
    }
    return false;
  }

  function playEvent(room, p, cardId, targetId) {
    const idx = p.eventHand.findIndex((c) => c.id === cardId);
    if (idx < 0) return '沒有這張卡';
    const card = p.eventHand[idx];
    if (!canPlay(room, p, card)) return '現在不能使用這張卡';
    const pd = room.pending;
    let tgt = null;
    if (card.target) {
      tgt = byId(room, targetId);
      if (!tgt || !tgt.alive || tgt.id === p.id) return '請選擇有效的目標玩家';
      if (card.key === 'misdirect' && tgt.id === pd.actorId) return '不能讓攻擊者打自己';
    }
    p.eventHand.splice(idx, 1);
    room.eventDiscard.push(card);
    const actor = pd && pd.actorId ? byId(room, pd.actorId) : null;
    switch (card.key) {
      case 'parry': pd.cancelled = true; log(room, `✋ ${p.name} 使用【格擋】，${actor.name} 的攻擊將無效！`); break;
      case 'glance': pd.damage = Math.floor(pd.damage / 2); log(room, `🩹 ${p.name} 使用【擦傷】，傷害降為 ${pd.damage}`); break;
      case 'empower': pd.damage += 15; log(room, `🔥 ${p.name} 使用【狂怒祝福】，傷害提升為 ${pd.damage}`); break;
      case 'misdirect': pd.target = tgt.id; pd.damage = Math.floor(pd.damage / 2); log(room, `😈 ${p.name} 使用【誤傷友軍】，攻擊轉向 ${tgt.name}（${pd.damage}）`); break;
      case 'dodge': pd.cancelled = true; log(room, `🌀 ${p.name} 使用【翻滾閃避】`); break;
      case 'shove': pd.targetId = tgt.id; log(room, `🫸 ${p.name} 使用【推人擋刀】，把 ${tgt.name} 推到怪物面前！`); break;
      case 'curse': pd.damage += 10; log(room, `🕯️ ${p.name} 使用【詛咒】，怪物傷害提升為 ${pd.damage}`); break;
      case 'shield': pd.damage = Math.ceil(pd.damage / 2); log(room, `🛡️ ${p.name} 使用【守護之盾】，怪物傷害降為 ${pd.damage}`); break;
      case 'potion': p.hp = Math.min(MAX_HP, p.hp + 20); log(room, `🧪 ${p.name} 喝下【治療藥水】（${p.hp} HP）`); break;
      case 'swap': [p.init, tgt.init] = [tgt.init, p.init]; log(room, `⚡ ${p.name} 使用【搶先一步】，與 ${tgt.name} 交換先攻`); break;
    }
    // 有人出牌 → 重新開啟反應窗讓其他人回應
    if (room.reaction && room.phase === 'resolve') {
      clearTimeout(room._timer);
      room.reaction.passed = {};
      room.reactSeq++; room.reaction.seq = room.reactSeq;
      room.reaction.deadline = Date.now() + REACT_MS;
      room._timer = setTimeout(() => closeReaction(room), REACT_MS);
    }
    changed(room);
    return null;
  }

  // ───────────── 對每位玩家的視角（隱藏別人的手牌） ─────────────
  function viewFor(room, me) {
    const showChosen = room.phase === 'resolve';
    return {
      code: room.code, phase: room.phase, hostId: room.hostId, round: room.round, meId: me.id,
      log: room.log.slice(-60),
      encounterIdx: room.encounterIdx, encounterCount: room.encounters ? room.encounters.length : 0,
      monster: room.monster && room.phase !== 'lobby' ? { ...room.monster, abilityDesc: ABILITY_DESC[room.monster.ability], targetDesc: TARGET_DESC[room.monster.target], curDmg: monsterDamage(room) } : null,
      players: room.players.map((p) => ({
        id: p.id, name: p.name, hp: p.hp, prestige: p.prestige, alive: p.alive, init: p.init, connected: p.connected,
        kills: p.kills || [], guard: p.guard, events: p.eventHand ? p.eventHand.length : 0,
        ready: !!p.chosen, chosen: showChosen && p.chosen ? p.chosen.name : null,
        passed: room.reaction ? !!room.reaction.passed[p.id] : false,
      })),
      pending: room.pending ? { ...room.pending, card: room.pending.card ? room.pending.card.name : null } : null,
      reactionLeft: room.reaction ? Math.max(0, room.reaction.deadline - Date.now()) : null,
      reactionTotal: REACT_MS,
      pendingSeq: room.reaction ? room.reaction.seq : null,
      winners: room.winners || [],
      me: {
        actionHand: me.actionHand || [],
        eventHand: (me.eventHand || []).map((c) => ({ ...c, playable: room.phase !== 'lobby' && canPlay(room, me, c) })),
        chosen: me.chosen || null,
      },
    };
  }

  // 連線狀態改變（由網路層呼叫）
  function setConnected(room, playerId, on) {
    const p = byId(room, playerId);
    if (!p || p.connected === on) return;
    p.connected = on;
    if (!on) {
      if (room.phase === 'planning') maybeBeginResolve(room);
      if (room.reaction) checkAllPassed(room);
    }
    changed(room);
  }

  // ───────────── 玩家指令 ─────────────
  function handleAction(room, playerId, body) {
    const p = byId(room, playerId);
    if (!p) return { error: '身分無效' };
    switch (body.type) {
      case 'start':
        if (p.id !== room.hostId) return { error: '只有房主能開始' };
        if (room.phase !== 'lobby' && room.phase !== 'gameover') return { error: '遊戲進行中' };
        if (room.players.length < 2) return { error: '至少需要 2 名玩家（建議 3–6 人）' };
        startGame(room);
        return { ok: true };
      case 'kick': {
        if (p.id !== room.hostId || room.phase !== 'lobby') return { error: '只有房主能在大廳踢人' };
        const t = byId(room, body.targetId);
        if (!t || t.id === p.id) return { error: '無效的目標' };
        room.players = room.players.filter((x) => x !== t);
        log(room, `🚪 ${t.name} 被請離房間`);
        changed(room);
        return { ok: true, kicked: t.id };
      }
      case 'choose': {
        if (room.phase !== 'planning' || !p.alive) return { error: '現在不能出牌' };
        const i = p.actionHand.findIndex((c) => c.id === body.cardId);
        if (i < 0) return { error: '沒有這張卡' };
        if (p.chosen) p.actionHand.push(p.chosen);
        p.chosen = p.actionHand.splice(p.actionHand.findIndex((c) => c.id === body.cardId), 1)[0];
        changed(room);
        maybeBeginResolve(room);
        return { ok: true };
      }
      case 'unchoose':
        if (room.phase !== 'planning' || !p.chosen) return { error: '無法收回' };
        p.actionHand.push(p.chosen); p.chosen = null;
        clearTimeout(room._resolveTimer);
        changed(room);
        return { ok: true };
      case 'event': {
        const err = playEvent(room, p, body.cardId, body.targetId);
        return err ? { error: err } : { ok: true };
      }
      case 'pass':
        if (room.reaction && body.seq === room.reaction.seq) { room.reaction.passed[p.id] = true; checkAllPassed(room); }
        return { ok: true };
      case 'chat':
        log(room, `💬 ${p.name}：${String(body.text || '').slice(0, 80)}`);
        changed(room);
        return { ok: true };
    }
    return { error: '未知指令' };
  }

  window.CuttEngine = { createRoom, restoreRoom, serialize, addPlayer, handleAction, viewFor, setConnected, MAX_HP };
})();
