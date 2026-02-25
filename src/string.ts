import slugify from "slugify";

export default class Str {
  static mask = (text: string, start: number = 0, end: number = 0): string => {
    const length = text.length;
    const _start = start < 0 ? length + start : start;
    const _end = end <= 0 ? length + end : end;

    if (
      !length ||
      _start < 0 ||
      _start >= length ||
      _end <= 0 ||
      _end > length ||
      _start >= _end
    ) {
      return text;
    }

    const maskedLength = _end - _start;

    return (
      text.substring(0, _start) +
      "*".repeat(maskedLength) +
      text.substring(_end)
    );
  };

  static normalize(text: string) {
    if (typeof text !== "string") {
      return text;
    }

    slugify.extend({
      ".": " ",
      "-": " ",
    });

    return slugify(text, {
      lower: true,
      locale: "vi",
      trim: true,
      replacement: " ",
      remove: /[^\w\s]+/g,
    });
  }

  /**
   * Normalize Vietnamese accent marks according to Vietnamese grammar rules
   * @param text - The text to normalize
   * @returns The normalized text with proper accent placement
   */
  static normalizeVietnameseAccent(text: string): string {
    if (typeof text !== "string") {
      return text;
    }

    const TONE_MARKS_REGEX = /[\u0300\u0301\u0303\u0309\u0323]/; // Unicode hex codes for the 5 Vietnamese tone marks
    const VOWELS_REGEX = /[aăâeêioôơuưy]+/i; // Pattern to find Vietnamese vowels (can include circumflex/breve like â, ă, ê, ô, ơ, ư)

    /**
     * Determine the index of the vowel that should receive the tone mark
     * Based on Vietnamese orthography rules
     */
    const getTargetVowelIndex = (
      vowels: string,
      hasFinalConsonant: boolean,
    ) => {
      // Exception 1: Vowels "ê" or "ơ" always have priority for the tone mark (e.g., chuyện -> yê, thuở -> uơ)
      const priorityIndex = vowels.search(/[êơ]/i);
      if (priorityIndex !== -1) return priorityIndex;

      // Rule 1: If there is only 1 vowel, place the tone mark on it (e.g., á, tã, nhà)
      if (vowels.length === 1) return 0;

      // Rule 2: If there are 2 vowels (diphthong)
      if (vowels.length === 2) {
        // - With a final consonant: place tone mark on the 2nd vowel (e.g., toàn -> oa + n -> mark on a)
        // - Without a final consonant: place tone mark on the 1st vowel (e.g., tòa -> oa -> mark on o)
        return hasFinalConsonant ? 1 : 0;
      }

      // Rule 3: If there are 3 or more vowels (triphthong), always place the tone mark on the 2nd vowel
      // (e.g., khuỷu -> uyu -> mark on y)
      return 1;
    };

    return text
      .normalize("NFC")
      .split(/(\s+|\p{P}+)/u)
      .map((word) => {
        // Skip whitespaces and punctuations
        if (/\s|\p{P}/u.test(word)) return word;

        // Step 1: Use Unicode NFD to separate base characters and tone marks
        // Example: "huỷ" (1 char ỷ) -> "huy" (3 chars) + hook above mark (1 char \u0309)
        const nfd = word.normalize("NFD");

        // Check if this word contains any tone mark
        const toneMatch = nfd.match(TONE_MARKS_REGEX);
        if (!toneMatch) return word;

        const toneMark = toneMatch[0];

        // Step 2: Create a "base" word with absolutely no tone marks
        // By removing the found tone mark, then normalizing back to NFC
        // Example: "huỷ" -> "huy"
        const baseWord = nfd
          .replace(new RegExp(TONE_MARKS_REGEX, "g"), "")
          .normalize("NFC");

        let consonantPrefix = "";
        let searchString = baseWord;

        // Step 3: Extract special initial consonant clusters
        // In Vietnamese, "i" in "gi" and "u" in "qu" are often not considered
        // main vowels for tone placement if there's another vowel following them.
        const specialClusters = [
          /^gi(?=[aăâeêoôơuưy])/i,
          /^qu(?=[aăâeêioôơuưy])/i,
        ];

        for (const clusterRegex of specialClusters) {
          const match = baseWord.match(clusterRegex);
          if (match) {
            consonantPrefix = match[0];
            searchString = baseWord.substring(consonantPrefix.length);
            break; // Stop after finding the first matching cluster
          }
        }

        // Step 4: Find the vowel cluster in the remaining part of the word
        const vowelsMatch = searchString.match(VOWELS_REGEX);
        if (!vowelsMatch) return word;

        const vowels = vowelsMatch[0];
        const vowelsStartIndex = vowelsMatch.index || 0;

        // Check if the word has a final consonant by comparing lengths
        // If word length > (initial consonant length + vowel start index + vowel cluster length)
        const hasFinalConsonant =
          baseWord.length >
          consonantPrefix.length + vowelsStartIndex + vowels.length;

        // Step 5: Determine the target vowel index to place the tone mark
        const targetVowelIndex = getTargetVowelIndex(vowels, hasFinalConsonant);

        // Calculate the absolute position of the target character in the entire base word
        const absoluteTargetIndex =
          consonantPrefix.length + vowelsStartIndex + targetVowelIndex;

        // Get the target character, split it with NFD, add the tone mark, and combine back with NFC
        const targetChar = baseWord[absoluteTargetIndex];
        const accentedChar = (targetChar.normalize("NFD") + toneMark).normalize(
          "NFC",
        );

        // Step 6: Reconstruct the complete word: Prefix + Accented Char + Suffix
        return (
          baseWord.substring(0, absoluteTargetIndex) +
          accentedChar +
          baseWord.substring(absoluteTargetIndex + 1)
        );
      })
      .join("");
  }
}
