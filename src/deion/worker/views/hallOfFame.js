// @flow

import { PHASE } from "../../common";
import { idb } from "../db";
import { g } from "../util";
import type { GetOutput, UpdateEvents } from "../../common/types";

async function updatePlayers(
    inputs: GetOutput,
    updateEvents: UpdateEvents,
): void | { [key: string]: any } {
    if (
        updateEvents.includes("firstRun") ||
        (updateEvents.includes("newPhase") && g.phase === PHASE.DRAFT_LOTTERY)
    ) {
        const stats =
            process.env.SPORT === "basketball"
                ? ["gp", "min", "trb", "ast", "pts", "per", "ewa", "ws", "ws48"]
                : ["keyStats", "av"];

        let players = await idb.getCopies.players({
            retired: true,
            filter: p => p.hof,
        });
        players = await idb.getCopies.playersPlus(players, {
            attrs: ["pid", "name", "draft", "retiredYear", "statsTids"],
            ratings: ["ovr", "pos"],
            stats: ["season", "abbrev", "tid", ...stats],
            fuzz: true,
        });

        // This stuff isn't in idb.getCopies.playersPlus because it's only used here.
        for (const p of players) {
            p.peakOvr = 0;
            for (const pr of p.ratings) {
                if (pr.ovr > p.peakOvr) {
                    p.peakOvr = pr.ovr;
                }
            }

            p.bestStats = {};
            let bestEWA = 0;
            p.teamSums = {};
            for (let j = 0; j < p.stats.length; j++) {
                const tid = p.stats[j].tid;
                const EWA =
                    process.env.SPORT === "basketball"
                        ? p.stats[j].ewa
                        : p.stats[j].av;
                if (EWA > bestEWA) {
                    p.bestStats = p.stats[j];
                    bestEWA = EWA;
                }
                if (p.teamSums.hasOwnProperty(tid)) {
                    p.teamSums[tid] += EWA;
                } else {
                    p.teamSums[tid] = EWA;
                }
            }
            p.legacyTid = parseInt(
                Object.keys(p.teamSums).reduce(
                    (teamA, teamB) =>
                        p.teamSums[teamA] > p.teamSums[teamB] ? teamA : teamB,
                    -1,
                ),
                10,
            );
        }

        return {
            players,
            stats,
            userTid: g.userTid,
        };
    }
}

export default {
    runBefore: [updatePlayers],
};
