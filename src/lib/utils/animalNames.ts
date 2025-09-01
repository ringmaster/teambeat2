/**
 * Generates consistent animal names for blame-free mode based on user+board hash
 */

const ADJECTIVES = [
    'Active', 'Agile', 'Alert', 'Bold', 'Brave', 'Bright', 'Busy', 'Calm', 'Clever', 'Cool',
    'Creative', 'Curious', 'Daring', 'Dynamic', 'Eager', 'Electric', 'Energetic', 'Epic', 'Fast', 'Fearless',
    'Fierce', 'Focused', 'Friendly', 'Gentle', 'Happy', 'Hardy', 'Helpful', 'Honest', 'Joyful', 'Keen',
    'Kind', 'Lively', 'Lucky', 'Mighty', 'Noble', 'Patient', 'Peaceful', 'Perky', 'Playful', 'Positive',
    'Powerful', 'Quick', 'Quiet', 'Radiant', 'Ready', 'Reliable', 'Sharp', 'Smart', 'Smooth', 'Speedy',
    'Spirited', 'Strong', 'Swift', 'Thoughtful', 'Vibrant', 'Wise', 'Witty', 'Zippy'
];

const ANIMALS = [
    'Aardvark', 'Alpaca', 'Antelope', 'Armadillo', 'Badger', 'Bat', 'Bear', 'Beaver', 'Bison', 'Bobcat',
    'Buffalo', 'Camel', 'Capybara', 'Cheetah', 'Chipmunk', 'Cougar', 'Coyote', 'Deer', 'Dolphin', 'Dromedary',
    'Eagle', 'Elephant', 'Elk', 'Falcon', 'Ferret', 'Fox', 'Gazelle', 'Giraffe', 'Goat', 'Groundhog',
    'Hamster', 'Hawk', 'Hedgehog', 'Hippo', 'Horse', 'Jackal', 'Jaguar', 'Kangaroo', 'Koala', 'Lemur',
    'Leopard', 'Lion', 'Llama', 'Lynx', 'Meerkat', 'Mongoose', 'Moose', 'Otter', 'Owl', 'Panda',
    'Panther', 'Penguin', 'Platypus', 'Porcupine', 'Raccoon', 'Reindeer', 'Rhino', 'Seal', 'Sheep', 'Sloth',
    'Squirrel', 'Tiger', 'Turtle', 'Walrus', 'Weasel', 'Whale', 'Wolf', 'Zebra'
];

/**
 * Simple hash function for consistent results
 */
function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

/**
 * Generates a consistent animal name based on a seed string
 * @param seed - String to use as seed (typically userName + boardId)
 * @returns Animal name like "Active Weasel" or "Perky Dromedary"
 */
export function generateAnimalName(seed: string): string {
    const hash = hashString(seed);
    
    const adjectiveIndex = hash % ADJECTIVES.length;
    const animalIndex = Math.floor(hash / ADJECTIVES.length) % ANIMALS.length;
    
    return `${ADJECTIVES[adjectiveIndex]} ${ANIMALS[animalIndex]}`;
}

/**
 * Gets the display name for a user on a board
 * @param userName - The user's real name
 * @param boardId - The board ID
 * @param blameFreeMode - Whether blame-free mode is enabled
 * @returns Display name (real name or animal name)
 */
export function getUserDisplayName(userName: string, boardId: string, blameFreeMode: boolean): string {
    if (!blameFreeMode) {
        return userName;
    }
    
    return generateAnimalName(userName + boardId);
}