// All text in the game: the opening before a new run, the ending at the
// summit, and the figures' lines. One entry per line on screen.

import type { FigureLines } from "./core/figureCore.ts";

export const OPENING: readonly string[] = [
  "I have a parcel.",
  "There was a name on it once. The rain took it, or the years did.",
  "I don't remember who gave it to me. I don't remember who it's for.",
  "But a parcel is meant for someone. So someone must be there.",
  "Everything down here is empty. The only way left to look is up.",
];

export const ENDING: readonly string[] = [
  "This is the top. There is nowhere further to go.",
  "I thought there would be a door. A hand. A name.",
  "There is only the wind.",
  "I could open it. I won't. It was never mine.",
  "I'll set it down here, where someone would look.",
  "I'll wait a little while.",
];

/**
 * What each figure says: first-visit lines, and return lines for when the
 * courier comes back after falling below it. Keyed by the figure ids in the
 * level data.
 */
export const FIGURE_LINES: Readonly<Record<string, FigureLines>> = {
  door: {
    first: [
      "I left the door open so they wouldn't have to knock.",
      "They always forgot their key. I used to be angry about that.",
      "I kept their cup on the table. The dust is in it now, but it's still their cup.",
      "Someone will come up these stairs one day. Someone always did.",
    ],
    return: [
      "Oh. I thought, for a moment. No.",
      "Come in anyway, if you like. The door's open.",
    ],
  },
  builder: {
    first: [
      "We were going to finish it. Someone said there was no hurry.",
      "I measured every room twice. For a family, they told me. Big windows.",
      "Nobody moved in. I keep the plans dry anyway.",
      "A thing doesn't have to be finished to be kept.",
    ],
    return: [
      "The rain got into the east side again.",
      "I'd fix it. I just can't remember who for.",
    ],
  },
  listener: {
    first: [
      "Can you hear it? Someone's still dancing.",
      "I used to know all their names. We'd stay until the lights came on.",
      "I stopped going in. I liked it better with the wall between us.",
      "Now the wall is all I have left of them.",
    ],
    return: [
      "It's the same song. It's been the same song for a long time.",
      "I don't mind. I've stopped waiting for it to end.",
    ],
  },
  forgotten: {
    first: [
      "I had a name like everyone. I wore it out from saying it.",
      "There was a face that went with it. Someone else's, I think. Someone I'd look for.",
      "Now I only remember that I remembered.",
      "It's quieter this way. I'm not sure it's better.",
    ],
    return: [
      "Have we met? It feels like we have.",
      "I'm sorry. Things don't stay with me anymore.",
    ],
  },
  keeper: {
    first: [
      "I oil them every morning. If I stop, then it's really over.",
      "They carried people once. Hundreds a day. You had to shout over them.",
      "Now they only carry the weather.",
      "Someone has to keep them ready. In case.",
    ],
    return: [
      "They're still running. I made sure.",
      "I don't know how to stop. Nobody ever told me.",
    ],
  },
  "let-go": {
    first: [
      "I held on too long. Or not long enough. I've had a long time to decide.",
      "Her hand was cold. Mine was colder. We were both very tired.",
      "I don't remember letting go. Only after.",
      "You'd think that would be the part you keep.",
    ],
    return: [
      "Some things come back. I keep telling myself that.",
      "I've stopped looking down. There's nothing down there that's mine.",
    ],
  },
  waiting: {
    first: [
      'There was a sign here once. It said something like "wait here". So I do.',
      "I don't know who put it up. I don't know what I'm waiting for.",
      "But the sign was very clear about it.",
      "Some days the fog lifts, a little. There's never anyone there.",
    ],
    return: [
      "You were here before. Or I was.",
      "I'm still waiting. It's easier with two.",
    ],
  },
};
