import json
import os
import sys
from pathlib import Path

import ctranslate2
import sentencepiece as spm


def emit(value: dict[str, object]) -> None:
    sys.stdout.write(json.dumps(value, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> None:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    model_dir = Path(os.environ["GRAMMAR_LOCAL_TRANSLATION_MODEL_DIR"])
    thread_count = max(
        1,
        int(os.environ.get("GRAMMAR_LOCAL_TRANSLATION_THREADS", "4")),
    )

    for filename in ("model.bin", "config.json", "source.spm", "target.spm"):
        if not (model_dir / filename).is_file():
            raise FileNotFoundError(
                f"Arquivo do modelo OPUS ausente: {model_dir / filename}"
            )

    source_tokenizer = spm.SentencePieceProcessor(
        model_file=str(model_dir / "source.spm")
    )
    target_tokenizer = spm.SentencePieceProcessor(
        model_file=str(model_dir / "target.spm")
    )
    translator = ctranslate2.Translator(
        str(model_dir),
        device="cpu",
        compute_type="int8",
        inter_threads=1,
        intra_threads=thread_count,
    )

    for line in sys.stdin:
        request_id = "unknown"
        try:
            request = json.loads(line)
            request_id = request["requestId"]
            examples = request["input"]["examples"]
            source_tokens = [
                source_tokenizer.encode(">>pob<< " + example["japanese"], out_type=str)
                for example in examples
            ]
            results = translator.translate_batch(
                source_tokens,
                beam_size=4,
                max_decoding_length=256,
            )
            translations = [
                {
                    "sourceId": example["sourceId"],
                    "translation": target_tokenizer.decode(
                        result.hypotheses[0]
                    ).strip(),
                }
                for example, result in zip(examples, results, strict=True)
            ]
            emit(
                {
                    "requestId": request_id,
                    "ok": True,
                    "response": json.dumps(
                        {"translations": translations}, ensure_ascii=False
                    ),
                }
            )
        except Exception as error:  # Keep the worker alive; caller rejects this pattern.
            emit({"requestId": request_id, "ok": False, "error": str(error)})


if __name__ == "__main__":
    main()