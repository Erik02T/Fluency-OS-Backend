import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';
import { z } from 'zod';

const JapaneseTextSchema = z.string().trim().min(1);
const ReadingSchema = z.string().trim().min(1);

export class JapaneseReadingGenerator {
  private kuroshiro: Kuroshiro | null = null;
  private initialization: Promise<Kuroshiro> | null = null;

  async toHiragana(japanese: string): Promise<string> {
    const text = JapaneseTextSchema.parse(japanese);
    const kuroshiro = await this.getKuroshiro();
    const reading = await kuroshiro.convert(text, {
      to: 'hiragana',
      mode: 'normal',
    });

    return ReadingSchema.parse(reading);
  }

  private async getKuroshiro(): Promise<Kuroshiro> {
    if (!this.initialization) {
      this.initialization = this.initialize();
    }

    this.kuroshiro = await this.initialization;
    return this.kuroshiro;
  }

  private async initialize(): Promise<Kuroshiro> {
    const kuroshiro = new Kuroshiro();
    await kuroshiro.init(new KuromojiAnalyzer());
    return kuroshiro;
  }
}
