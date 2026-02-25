# LLM Fine-Tuning Learning Plan
**Date:** 2026-02-24
**Project:** AI Personal Assistant (Cloudflare Workers)
**Goal:** Fine-tune Llama 3.2 3B with QLoRA → deploy LoRA adapter to Cloudflare Workers AI
**Reviewed by:** 3 parallel agents (ML Pedagogy, Cloudflare Technical, Dataset Strategy)

---

## Learner Profile

| Attribute | Value |
|---|---|
| ML background | Familiar with ML concepts (loss, training loops, tokenization) — new to LLMs |
| Learning style | Approach B: notebook first, theory alongside |
| Compute | Colab Pro (A100/L4) |
| Time | 1-2 hours daily (~12h/week) |
| Timeline | ~4 weeks to production deployment |

---

## Architecture Decision

**Base model for training AND deployment:** `@cf/meta/llama-3.2-3b-instruct`

> **CRITICAL**: The base model used in Colab training and the model string passed to `env.AI.run()` on Cloudflare MUST be identical. A LoRA adapter trained on a 3B model is architecturally incompatible with an 8B model — the weight dimensions are different. Do not mix these.

**Why 3B over 8B for this task:**
- Llama 3.2 3B fits on a free Colab T4 (7GB VRAM) and very fast on Colab Pro A100
- 3B is sufficient for a closed 10-tool JSON-output task (format learning, not general reasoning)
- Faster iteration — training runs complete in under an hour on A100
- Lower inference cost on Cloudflare (fewer Neurons per request)

**Why NOT the current 70B production model:**
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast` is a quantized (fp8) model — Cloudflare explicitly excludes quantized models from LoRA support
- You cannot apply a LoRA adapter to this model on Cloudflare

---

## Day 1: Compatibility Check (15 minutes — do this FIRST)

Before writing a single line of training code, verify:

1. Open [Cloudflare Workers AI models list with LoRA filter](https://developers.cloudflare.com/workers-ai/models/?capabilities=LoRA) — confirm `@cf/meta/llama-3.2-3b-instruct` appears
2. Note the current rank limit: **r ≤ 32** (updated in 2025 from the old r ≤ 8 limit)
3. Note the file size limit: **300MB** per adapter
4. Note: **fine-tunes cannot be updated after upload** — you must create a new one to change anything
5. Note: **100 adapter per account limit** currently

> If your target model is not on the LoRA list, choose a different base model BEFORE investing training time.

---

## Section 1 — Mental Model

**Read theory when you need it, not all upfront. Follow this schedule:**

| When | Read | Why now |
|---|---|---|
| Day 1 — after first notebook run | [LoRA paper](https://arxiv.org/abs/2106.09685) abstract + Section 4 only | You've seen adapter files appear — now understand what's in them |
| Day 2 — before dataset swap | [Unsloth chat templates docs](https://unsloth.ai/docs/basics/chat-templates) | You NEED this before swapping datasets or training breaks silently |
| Day 2 — before dataset swap | [HuggingFace chat templating docs](https://huggingface.co/docs/transformers/chat_templating) | Llama 3.2 uses `<\|eot_id\|>` — format must match exactly |
| Day 3 — after xLAM dataset exploration | [QLoRA paper](https://arxiv.org/abs/2305.14314) abstract + Section 2 | Now the quantization details have concrete context |
| Day 5 — before custom training | [philschmid 2025 SFT guide](https://www.philschmid.de/fine-tune-llms-in-2025) | Full overview of current stack (QLoRA, Flash Attention, Liger Kernels) |
| Day 8 — before evaluating loss curves | [HuggingFace LLM Course Chapter 3 — Learning Curves](https://huggingface.co/learn/llm-course/en/chapter3/5) | Framework for diagnosing train/eval divergence |
| Day 8 — evaluation phase | [Raschka LoRA practical tips](https://magazine.sebastianraschka.com/p/practical-tips-for-finetuning-llms) | Rank selection, alpha, learning rate intuition |

---

## Section 2 — Day 1 Notebook: First Fine-Tune

**Goal:** Complete training run by end of Day 1, exporting an adapter checkpoint.

### Toolchain

```
Unsloth         2x faster training, 60% less VRAM, wraps HuggingFace
TRL SFTTrainer  Supervised fine-tuning trainer
PEFT            LoRA adapter management
bitsandbytes    4-bit quantization (QLoRA)
Datasets        Load datasets from HuggingFace Hub
```

### Day 1 Action

Run the Unsloth Llama 3.2 3B Instruct notebook on Colab Pro:
→ [Unsloth Llama 3.2 3B Conversational Colab](https://colab.research.google.com/github/unslothai/unsloth/blob/main/nb/Llama_3.2_3B_Instruct_Conversational.ipynb)

**What to observe while it runs:**
- Loss curve — should drop fast in first 50 steps then plateau
- `train_loss` vs `eval_loss` — a growing gap = overfitting
- Tokens/sec — A100 should show 600-900 tok/sec with Unsloth
- Sample outputs at checkpoints — do they look like coherent text?

### EOS / PAD Token Warning

Llama 3.2 uses `<|eot_id|>` as the turn-end token and `<|end_of_text|>` as the true EOS. If PAD token equals EOS token, training masks out stop tokens and the model never learns to stop generating.

Unsloth sets this correctly by default. **If you ever customize the tokenizer, verify:**
```python
assert tokenizer.pad_token != tokenizer.eos_token
```

### Day 2–3: Dataset Swap

Swap the training dataset from `FineTome-100k` to `Salesforce/xlam-function-calling-60k`.

**Read the xLAM cookbook FIRST:** [HuggingFace xLAM function calling cookbook](https://huggingface.co/learn/cookbook/function_calling_fine_tuning_llms_on_xlam)

Budget 1 full 2-hour session just for the format conversion — xLAM uses a completely different schema than the ShareGPT format and Llama 3.2's chat template. This is not a quick swap.

---

## Section 3 — Build Your Custom Dataset

**This is the highest-leverage part of the plan. Data quality determines model quality more than any hyperparameter.**

### Format Specification (Zero Tolerance for Variation)

Every training example must use this exact output format in the `gpt` turn:

```
I'll [action description].

```json
{"tool": "toolName", "params": {"key": "value"}}
```
```

Every example must use the same system prompt format — your exact inference-time system prompt (the one generated by `generateToolDocs()` in `memory.ts`). Strip and replace all system prompts from public datasets.

**Run a format validation script on every example before training.** Parse the assistant turn, check for valid JSON inside a code block, check that `tool` and `params` keys exist, check that `tool` is one of your 10 valid tool names. Reject anything that doesn't pass.

### Revised Dataset Size Targets

| Goal | Min examples | Notes |
|---|---|---|
| Format learning at all | 300–400 | The 50-example floor is not viable — overfitting guaranteed |
| Reliable single-tool calls | 500–600 | With high quality, varied phrasing |
| Multi-tool + disambiguation | 800–1,000 | Must include negative examples and multi-turn |
| Robust generalization | 1,500+ | Varied phrasing (formal, casual, fragmentary, ambiguous) |

**First training target: 800–1,000 total examples**

### Composition (Revised from 50/50 to 30/70 public/custom)

| Source | Target yield | Notes |
|---|---|---|
| Hand-crafted examples | 300–400 | Highest quality per example; includes disambiguation pairs |
| Synthetic via Claude API | 400–600 | See synthetic generation guidance below |
| `glaiveai/glaive-function-calling-v2` | 100–150 | ShareGPT format, Microsoft-validated, closest to your format |
| `Salesforce/APIGen-MT-5k` | 100–150 | Multi-turn trajectories (April 2025), covers context threading |
| `hypervariance/function-calling-sharegpt` | 80–100 | Already partially cleaned for training |
| `NousResearch/hermes-function-calling-v1` | 80–100 | High quality but requires XML→markdown conversion |
| `Salesforce/xlam-function-calling-60k` | 50–80 | Hardest to reformat — use last, not first |

> **Note on xLAM:** Realistic yield after filtering and reformatting is 150–250 examples, not the ~400 originally proposed. It uses `[{"name": "...", "arguments": {...}}]` format that requires field renaming and structural transformation.

### Required Dataset Types

#### 1. Single-Tool Positive Examples (~400–500)
20–30 examples per tool. For each tool, vary:
- Phrasing: formal ("Please schedule"), casual ("can you book"), fragmentary ("meeting tmrw 3pm")
- With/without optional parameters
- Different time references ("next Monday", "in 2 hours", "tomorrow morning")

**Critical: 60–80 contrastive pairs for createTask vs createCalendarEvent**

| User says | Correct tool |
|---|---|
| "Remind me to call John tomorrow" | `createTask` |
| "Add a call with John to my calendar tomorrow" | `createCalendarEvent` |
| "Set a reminder for dentist" | `createTask` |
| "Block my dentist appointment on Friday" | `createCalendarEvent` |
| "Remind me about dentist AND block it in calendar" | `createTask` + `createCalendarEvent` |

#### 2. Negative Examples — "No Tool Needed" (~80–120, ≈10–15% of total)

> **This is the most commonly missing element in function-calling datasets and directly causes over-triggering.**

Include examples where the correct response is plain text with NO JSON block:
- Pure conversation: "How are you?" → friendly response, no tool
- Information questions: "What does createTask do?" → explanation, no tool
- Clarifying questions that look tool-like: "What time zone are my tasks in?" → answer directly
- Out-of-scope queries: "What's the capital of France?" → plain answer

#### 3. Multi-Turn Context Examples (~100–150)
Use `Salesforce/APIGen-MT-5k` as a source. Include scenarios like:
- Create a task → mark it complete in next turn (requires threading task ID from prior result)
- List tasks → update the third one (requires context from list result)
- Create calendar event → user says "actually make it an hour earlier" → update

#### 4. CRUD Context Examples — updateTask, deleteTask, updateCalendarEvent, deleteCalendarEvent (~50–75 each)
These tools require entity IDs from prior context. Standalone schema examples are insufficient. Show the model correctly using IDs received from prior tool results.

#### 5. Multi-Tool Compound Examples (~50–80)
Scenarios requiring two JSON blocks in sequence. Define the exact output format for this:
```
I'll create the task and add it to your calendar.

```json
{"tool": "createTask", "params": {"title": "Dentist", "dueDate": "2026-03-01T10:00:00Z", "priority": "high"}}
```

```json
{"tool": "createCalendarEvent", "params": {"summary": "Dentist appointment", "startTime": "2026-03-01T10:00:00Z"}}
```
```

### Synthetic Data Generation with Claude

Use Claude via Anthropic API (NOT GPT-4o — OpenAI's ToS updated May 2025 prohibits using their outputs to train competing models).

**Prompt template for synthetic generation:**
```
You are creating training data for an AI assistant that emits tool calls in this exact format:

```json
{"tool": "TOOL_NAME", "params": {...}}
```

Tool: createTask
Schema: {title: string, description?: string, dueDate?: "ISO 8601 string", priority: "low"|"medium"|"high"}

Generate 30 diverse user messages that should trigger createTask.
For each, write the ideal assistant response including the JSON block.
Vary phrasing: formal, casual, fragmentary, with/without dates.
Include 3–4 where the user mentions both a task AND calendar — createTask only for these.

Output as JSONL. Each line must be exactly:
{"conversations": [{"from":"system","value":"[YOUR EXACT SYSTEM PROMPT]"},{"from":"human","value":"..."},{"from":"gpt","value":"...```json\n{...}\n```"}]}
```

**After generation:** Human-review 15% of synthetic examples before including in training. Check for semantic errors (wrong tool for the intent) and format errors (wrong key names, missing code block).

### Train/Eval Split

Reserve 15% of your complete dataset (~120–150 examples) as a held-out validation set **before building the training set**. Never touch these for dataset fixes. Use them only for loss curve tracking during training.

---

## Section 4 — Training + Evaluation

### Training Configuration

```python
from unsloth import FastLanguageModel
from trl import SFTTrainer, TrainingArguments

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Llama-3.2-3B-Instruct",
    max_seq_length=2048,
    load_in_4bit=True,  # QLoRA
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,                    # LoRA rank — valid for Cloudflare (r ≤ 32)
    lora_alpha=32,           # Always 2 × r
    target_modules="all-linear",   # NOT just q/v — all-linear significantly outperforms
    lora_dropout=0.05,
)

# CRITICAL: Train only on assistant responses, not user/system tokens
from unsloth.chat_templates import train_on_responses_only
trainer = train_on_responses_only(
    trainer,
    instruction_part="<|start_header_id|>user<|end_header_id|>\n\n",
    response_part="<|start_header_id|>assistant<|end_header_id|>\n\n",
)
```

### Key Hyperparameter Decisions

| Parameter | Start value | When to increase | When to decrease |
|---|---|---|---|
| `r` (rank) | 16 | Accuracy plateaus below 80% | OOM errors |
| `lora_alpha` | 32 | Never change independently | Never change independently |
| `learning_rate` | 2e-4 | Loss barely moves after 100 steps | Loss spikes or collapses to 0 |
| `num_epochs` | 2 | Val accuracy still improving at end | Train/eval loss gap grows |
| `per_device_train_batch_size` | 4 | VRAM allows it (check A100 util) | OOM errors |

> **Start with 2 epochs, not 3.** At 800 examples, 3 epochs risks overfitting. Extend only if val accuracy is still improving.

### The Iteration Loop

```
Train (2 epochs) → Evaluate (50 test prompts at temp=0) → Diagnose → Fix → Retrain
```

**Evaluation must use temperature=0:**
```python
outputs = model.generate(
    inputs,
    temperature=0,
    do_sample=False,        # Greedy decoding — deterministic output
    max_new_tokens=200,
)
```
> Function-calling correctness is deterministic. Using sampling makes it impossible to diagnose whether the model has learned the format.

### Diagnosis Table

| Observation | Root cause | Fix |
|---|---|---|
| Train loss drops fast, eval follows | Healthy | Continue |
| Train 0.1, eval 0.8+ | Overfitting | Add more diverse examples; reduce to 1 epoch; lower lr |
| Both losses plateau above 1.5 | Underfitting / format issue | Check all examples are correctly formatted; check chat template |
| Right tool, malformed JSON | Partial format learning | Add more examples for that specific tool; stricter format in training data |
| Calls tool when shouldn't | Missing negatives | Add "no tool needed" examples (Section 3, Type 2) |
| Wrong tool selected | Disambiguation | Add contrastive pairs for confused tools |
| General answers degrade | Catastrophic forgetting | Mix in 50–100 general instruction examples (e.g., Alpaca); reduce epochs |

### Catastrophic Forgetting

When you fine-tune aggressively on 800 narrow examples, the model may degrade on general conversation. Signs: generic questions get tool responses, basic factual questions fail, conversation feels robotic.

**Mitigation:** Mix ~10% general instruction data into training set (~80–100 examples of normal Q&A with no tool calls). This preserves general capabilities while the model learns tool-calling.

---

## Section 5 — Deploy to Cloudflare Workers AI

### Step 1: Export (Adapter-Only — NOT Merged)

```python
# Cloudflare applies the adapter at inference time on their hosted base model.
# Export adapter-only — do NOT merge weights.
model.save_pretrained("my-adapter")      # saves adapter_model.safetensors + adapter_config.json
tokenizer.save_pretrained("my-adapter")
```

**Do NOT use `save_method="merged_16bit"` or `save_method="merged_4bit"` — these produce full-weight models that are too large to upload and incompatible with Cloudflare's LoRA inference.**

### Step 2: Edit adapter_config.json

Add ONE field — `model_type`. Do not remove any fields generated by Unsloth/PEFT:

```json
{
  "model_type": "llama",
  "peft_type": "LORA",
  "task_type": "CAUSAL_LM",
  "r": 16,
  "lora_alpha": 32,
  "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj", ...],
  ...
}
```

`model_type` must be one of: `"mistral"`, `"gemma"`, or `"llama"`.

### Step 3: Upload via Wrangler (Corrected Syntax)

The correct command is a **single step** — creation and upload together:

```bash
# Both files must be in the same folder, named exactly:
#   adapter_model.safetensors
#   adapter_config.json

npx wrangler ai finetune create @cf/meta/llama-3.2-3b-instruct my-assistant-lora ./my-adapter/
```

There is NO separate `wrangler ai finetune upload` subcommand. The command above handles both creation and upload from the specified folder path.

**Alternative via REST API (if Wrangler gives issues):**
```bash
# Step 1: Create finetune record
curl -X POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/finetunes \
  -H "Authorization: Bearer {CF_API_TOKEN}" \
  -H "Content-Type: application/json"

# Step 2: Upload adapter weights (use returned finetune ID)
curl -X POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/finetunes/{FINETUNE_ID}/finetune-assets/ \
  -H "Authorization: Bearer {CF_API_TOKEN}" \
  -F "file_name=adapter_model.safetensors" \
  -F "file=@adapter_model.safetensors"

# Step 3: Upload config
curl -X POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/finetunes/{FINETUNE_ID}/finetune-assets/ \
  -H "Authorization: Bearer {CF_API_TOKEN}" \
  -F "file_name=adapter_config.json" \
  -F "file=@adapter_config.json"
```

Requires a Cloudflare API Token with **Workers AI: Edit** permissions.

### Step 4: Update PersonalAssistant.ts

```typescript
// In generateLLMResponse() and generateLLMResponseWithRAG():

// FROM (current):
const model = this.env.LLM_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const llmPromise = this.env.AI.run(modelKey, { messages, max_tokens, temperature });

// TO (fine-tuned):
const model = '@cf/meta/llama-3.2-3b-instruct';  // Must match training base model exactly
const llmPromise = this.env.AI.run(model as any, {
  messages,
  max_tokens: maxTokens,
  temperature,
  lora: 'my-assistant-lora',   // Your uploaded finetune name
  // raw: true,                // Uncomment if Cloudflare's default chat template conflicts
});
```

> **`raw: true`**: If the fine-tuned model outputs odd formatting or doesn't follow the expected turn structure, add `raw: true` to bypass Cloudflare's built-in chat template and use the model's learned template directly.

### Step 5: Deployment Verification

After uploading, **do not assume the adapter is loading**. Verify it's actually being applied:

```typescript
// Test call WITHOUT adapter (base model)
const baseResponse = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
  messages: [{ role: "user", content: "Remind me to call John tomorrow" }]
});

// Test call WITH adapter
const loraResponse = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
  messages: [{ role: "user", content: "Remind me to call John tomorrow" }],
  lora: 'my-assistant-lora'
});

// These outputs should be noticeably different.
// The LoRA version should contain ```json\n{"tool": "createTask"...
```

### Important Deployment Constraints

- Fine-tunes **cannot be updated after upload** — to change an adapter, create a new finetune
- **100 adapter limit per account** (clean up unused experiments)
- LoRA upload is **free during open beta** — inference billed via Neurons pricing (same as standard AI.run)
- Switching from 70B to 3B will significantly reduce Neurons consumption per request

---

## Section 6 — Weekly Milestone Schedule

### Week 1 (Days 1–7): First Notebook + LoRA Foundation
- **Day 1**: Cloudflare compatibility check (15 min) → Run Unsloth Colab notebook → Read LoRA abstract after run
- **Day 2**: Explore xLAM dataset format → Read Unsloth chat templates + HuggingFace chat templating docs
- **Day 3**: Attempt xLAM dataset swap → Read QLoRA abstract
- **Day 4–5**: Debug xLAM format conversion → Start writing 20–30 createTask examples
- **Day 6–7**: Read philschmid 2025 guide → Write 20–30 createCalendarEvent examples + 10 disambiguation pairs

### Week 2 (Days 8–14): Dataset Construction
- **Days 8–10**: Write hand-crafted examples for getWeather, sendEmail, listTasks (~20 each)
- **Days 11–12**: Write 30–40 "no tool needed" negative examples + 20 multi-turn examples
- **Day 13**: Run synthetic generation for remaining tools (updateTask, completeTask, deleteTask, updateCalendarEvent, deleteCalendarEvent) via Claude API
- **Day 14**: Format validation pass — run parser on every example, reject any that don't match spec; create 80/20 train/val split

### Week 3 (Days 15–21): First Custom Training Run + Evaluate
- **Day 15**: Launch training run on Colab Pro with custom dataset (2 epochs)
- **Day 16**: Read Raschka LoRA tips + HuggingFace learning curves guide while training
- **Day 17**: Evaluate 50 test prompts at temperature=0 — log failure modes categorically
- **Days 18–19**: Diagnose failures → fix dataset (most likely: add more negatives, fix format issues) → retrain
- **Days 20–21**: Second evaluation → decide if ready to deploy or iterate again

### Week 4 (Days 22–28): Deploy + Production Validation
- **Day 22**: Export adapter-only, edit adapter_config.json, upload via Wrangler
- **Day 23**: Deployment verification (base vs LoRA comparison test)
- **Days 24–25**: A/B test in staging: run 10 prompts against both 70B base and 3B fine-tuned, compare JSON validity and tool selection accuracy
- **Days 26–28**: Production switch, monitor first 48h, log any regressions

### Week 5+ (Ongoing): Iteration
- Add more contrastive examples for any tools that failed in production
- Expand multi-turn dataset to 200+
- Measure latency improvement vs original 70B model (target: <2s vs 4–8s)

---

## Master Resource Map

### Theory
| Resource | When to read | Link |
|---|---|---|
| LoRA paper (abstract + sec 4) | Day 1 post-run | [arxiv.org/abs/2106.09685](https://arxiv.org/abs/2106.09685) |
| QLoRA paper (abstract + sec 2) | Day 3 | [arxiv.org/abs/2305.14314](https://arxiv.org/abs/2305.14314) |
| philschmid 2025 SFT guide | Day 5 | [philschmid.de/fine-tune-llms-in-2025](https://www.philschmid.de/fine-tune-llms-in-2025) |
| Raschka LoRA practical tips | Day 16 | [sebastianraschka.com](https://magazine.sebastianraschka.com/p/practical-tips-for-finetuning-llms) |
| HuggingFace Learning Curves | Day 16 | [HF LLM Course Ch3](https://huggingface.co/learn/llm-course/en/chapter3/5) |

### Tooling
| Resource | Link |
|---|---|
| Unsloth GitHub | [github.com/unslothai/unsloth](https://github.com/unslothai/unsloth) |
| Unsloth chat templates | [unsloth.ai/docs/basics/chat-templates](https://unsloth.ai/docs/basics/chat-templates) |
| HF chat templating docs | [huggingface.co/docs/transformers/chat_templating](https://huggingface.co/docs/transformers/chat_templating) |
| HuggingFace xLAM cookbook | [HF Cookbook: xLAM fine-tuning](https://huggingface.co/learn/cookbook/function_calling_fine_tuning_llms_on_xlam) |
| Microsoft SLM function calling guide | [GitHub: microsoft/slm-finetuning-for-function-calling](https://github.com/microsoft/slm-finetuning-for-function-calling) |

### Datasets
| Dataset | Format | Priority | Link |
|---|---|---|---|
| Hand-crafted (your own) | Custom JSON | Highest | — |
| APIGen-MT-5k | Multi-turn trajectories | High | [HuggingFace](https://huggingface.co/datasets/Salesforce/APIGen-MT-5k) |
| glaive-function-calling-v2 | ShareGPT | Medium | [HuggingFace](https://huggingface.co/datasets/glaiveai/glaive-function-calling-v2) |
| hypervariance/function-calling-sharegpt | ShareGPT | Medium | [HuggingFace](https://huggingface.co/datasets/hypervariance/function-calling-sharegpt) |
| hermes-function-calling-v1 | ShareGPT (XML tags) | Medium | [HuggingFace](https://huggingface.co/datasets/NousResearch/hermes-function-calling-v1) |
| xlam-function-calling-60k | Custom (heavy reformat) | Low | [HuggingFace](https://huggingface.co/datasets/Salesforce/xlam-function-calling-60k) |

### Deployment
| Resource | Link |
|---|---|
| Cloudflare LoRA docs | [developers.cloudflare.com/workers-ai/features/fine-tunes/loras/](https://developers.cloudflare.com/workers-ai/features/fine-tunes/loras/) |
| Cloudflare LoRA-capable models list | [developers.cloudflare.com/workers-ai/models/?capabilities=LoRA](https://developers.cloudflare.com/workers-ai/models/?capabilities=LoRA) |
| Cloudflare fine-tunes overview | [developers.cloudflare.com/workers-ai/features/fine-tunes/](https://developers.cloudflare.com/workers-ai/features/fine-tunes/) |
| Cloudflare AutoTrain tutorial | [CF Workers AI AutoTrain guide](https://developers.cloudflare.com/workers-ai/guides/tutorials/fine-tune-models-with-autotrain/) |

---

## Success Metrics

| Metric | Target |
|---|---|
| Tool selection accuracy | >90% on 50-prompt test set |
| Valid JSON on every response | >98% |
| createTask vs createCalendarEvent disambiguation | >95% |
| "No tool needed" precision | >90% (model doesn't hallucinate tool calls) |
| Response latency | <2s (vs 4–8s for current 70B) |
| Adapter file size | <300MB (Cloudflare limit) |

---

## Common Pitfalls Quick Reference

| Pitfall | Symptom | Prevention |
|---|---|---|
| Wrong base model for deployment | Adapter uploads but output is garbage | Use exact same model string for training AND `env.AI.run()` |
| Merging adapter before upload | File too large; Cloudflare rejects | Use `save_pretrained()` not merged methods |
| Wrangler upload syntax wrong | Command not found error | Use `npx wrangler ai finetune create <model> <name> <folder>` |
| Missing `model_type` in config | Cloudflare rejects upload | Always add `"model_type": "llama"` to adapter_config.json |
| No negative examples | Model calls tools for everything | Include 10–15% "no tool needed" examples |
| No train/val split | Can't detect overfitting | Reserve 15% holdout BEFORE building training set |
| temperature != 0 during eval | Stochastic JSON, can't diagnose | Always eval with `temperature=0, do_sample=False` |
| `train_on_responses_only` omitted | Trains on user/system tokens, wastes capacity | Always call `train_on_responses_only()` in Unsloth |
| EOS == PAD token | Model never stops generating | Verify `tokenizer.pad_token != tokenizer.eos_token` |
| Format variation in training data | Model learns blended output format | Validate 100% of examples with a parser before training |
| Using GPT-4o for synthetic data | OpenAI ToS violation (May 2025) | Use Claude API or self-hosted open model for generation |
| Adapter not loading silently | Base model runs instead of fine-tuned | Always run base vs LoRA comparison test after upload |

---

## Agent Review Credits

This plan was reviewed and corrected by 3 parallel specialist agents:

- **ML Pedagogy Agent**: Identified sequencing issues (Cloudflare check on Day 1), missing concepts (catastrophic forgetting, train/eval split, negative examples, `train_on_responses_only`), timeline corrections
- **Cloudflare Technical Agent**: Caught base model mismatch (3B train vs 8B deploy = incompatible), corrected Wrangler commands, confirmed r≤32 rank limit, identified `raw: true` option, pricing details
- **Dataset Strategy Agent**: Revised size targets upward, identified xLAM's realistic yield (150-250, not 400), flagged OpenAI ToS issue for synthetic data, identified missing dataset types (negatives, multi-turn), recommended glaive-v2 and APIGen-MT-5k over xLAM as primary sources
