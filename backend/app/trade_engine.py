from typing import List, Dict, Set, Tuple
from sqlalchemy.orm import Session
from . import models
from .schemas import TradeResult, TradePartner, TradeChainStep, TradeSticker


def _to_schema(s: models.Sticker) -> TradeSticker:
    return TradeSticker(id=s.id, code=s.code, description=s.description,
                        country_name=s.country_name, is_foil=s.is_foil)


def _get_ids(user_id: int, table, db: Session) -> Set[int]:
    return {row.sticker_id for row in db.query(table).filter(table.user_id == user_id).all()}


def find_trades(current_user_id: int, db: Session, max_chain: int = 4) -> List[TradeResult]:
    other_users = db.query(models.User).filter(
        models.User.is_active == True,
        models.User.id != current_user_id,
        models.User.is_admin == False,
    ).all()

    if not other_users:
        return []

    my_have = _get_ids(current_user_id, models.UserHave, db)
    my_want = _get_ids(current_user_id, models.UserWant, db)

    if not my_have and not my_want:
        return []

    all_ids = [current_user_id] + [u.id for u in other_users]
    nick = {u.id: u.nickname for u in other_users}
    nick[current_user_id] = "Du"

    have: Dict[int, Set[int]] = {current_user_id: my_have}
    want: Dict[int, Set[int]] = {current_user_id: my_want}
    for u in other_users:
        have[u.id] = _get_ids(u.id, models.UserHave, db)
        want[u.id] = _get_ids(u.id, models.UserWant, db)

    # can_give[(a,b)] = sticker IDs a has that b wants
    can_give: Dict[Tuple[int, int], Set[int]] = {}
    for a in all_ids:
        for b in all_ids:
            if a != b:
                gifts = have[a] & want[b]
                if gifts:
                    can_give[(a, b)] = gifts

    sticker_cache: Dict[int, models.Sticker] = {}

    def get_s(sid: int) -> models.Sticker:
        if sid not in sticker_cache:
            sticker_cache[sid] = db.query(models.Sticker).filter(models.Sticker.id == sid).first()
        return sticker_cache[sid]

    results: List[TradeResult] = []

    # Direct trades
    for u in other_users:
        give_ids = can_give.get((current_user_id, u.id), set())
        recv_ids = can_give.get((u.id, current_user_id), set())

        if give_ids and recv_ids:
            results.append(TradeResult(
                type="perfect", label="Perfekter Tausch", color="green",
                partners=[TradePartner(
                    nickname=u.nickname,
                    give=[_to_schema(get_s(s)) for s in give_ids],
                    receive=[_to_schema(get_s(s)) for s in recv_ids],
                )],
            ))
        elif recv_ids:
            results.append(TradeResult(
                type="one_sided", label="Einseitiger Tausch", color="blue",
                partners=[TradePartner(
                    nickname=u.nickname, give=[],
                    receive=[_to_schema(get_s(s)) for s in recv_ids],
                )],
            ))
        elif give_ids:
            results.append(TradeResult(
                type="one_sided", label="Einseitiger Tausch", color="blue",
                partners=[TradePartner(
                    nickname=u.nickname,
                    give=[_to_schema(get_s(s)) for s in give_ids],
                    receive=[],
                )],
            ))

    # Chain trades (cycles 3-4 through current user)
    seen: set = set()
    chains: List[List[int]] = []

    def dfs(path: List[int]):
        last = path[-1]
        if len(path) > 1 and (last, current_user_id) in can_give and len(path) >= 3:
            key = tuple(sorted(path))
            if key not in seen:
                seen.add(key)
                chains.append(path[:])
        if len(path) >= max_chain:
            return
        for nxt in all_ids:
            if nxt not in path and (last, nxt) in can_give:
                path.append(nxt)
                dfs(path)
                path.pop()

    dfs([current_user_id])

    for chain in chains:
        n = len(chain)
        steps = []
        for i in range(n):
            a = chain[i]
            b = chain[(i + 1) % n]
            steps.append(TradeChainStep(
                from_user=nick[a],
                to_user=nick[b],
                stickers=[_to_schema(get_s(s)) for s in can_give[(a, b)]],
            ))
        results.append(TradeResult(
            type="chain",
            label=f"Kettentausch ({n} Personen)",
            color="orange",
            chain=steps,
        ))

    order = {"perfect": 0, "chain": 1, "one_sided": 2}
    results.sort(key=lambda x: order.get(x.type, 9))
    return results
