"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Check,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import { DashboardShell } from "@/components/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  createGrammarPoint,
  deleteGrammarPoint,
  getAdminGrammarDetail,
  getAdminGrammarList,
  updateGrammarPoint,
  type CreateGrammarPointDto,
  type GrammarDetailResponseDto,
  type GrammarListItemDto,
  type GrammarListQueryParams,
  type GrammarReviewStatus,
} from "@/lib/grammar-api"
import type { JLPTLevel } from "@/lib/kanji-api"
import { useRequireAdmin } from "@/hooks/use-require-admin"
import {
  ExamplesSection,
  type AdminExampleItem,
} from "@/components/content-admin/shared-form-sections"

const PAGE_SIZE = 12

const jlptOptions: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"]
const statusOptions: GrammarReviewStatus[] = [
  "PENDING",
  "GENERATED",
  "VALIDATED",
  "REVIEWED",
  "PUBLISHED",
]
const sortOptions: NonNullable<GrammarListQueryParams["sort"]>[] = [
  "position",
  "jlpt",
  "difficulty",
  "pattern",
  "createdAt",
]

const statusBadgeVariant: Record<GrammarReviewStatus, string> = {
  PENDING:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700",
  GENERATED:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  VALIDATED:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800",
  REVIEWED:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800",
  PUBLISHED:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
}

type FormErrors = Record<string, string>

interface GrammarStructuredFormState {
  pattern: string
  jlptLevel: JLPTLevel
  title: string
  shortExplanation: string
  detailedExplanation: string
  formalityLevel: string
  difficulty: string
  position: string
  tags: string
  examples: AdminExampleItem[]
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return "Falha inesperada no admin de gramática."
}

function emptyFormState(): GrammarStructuredFormState {
  return {
    pattern: "",
    jlptLevel: "N5",
    title: "",
    shortExplanation: "",
    detailedExplanation: "",
    formalityLevel: "",
    difficulty: "1",
    position: "",
    tags: "",
    examples: [],
  }
}

function detailToForm(detail: GrammarDetailResponseDto): GrammarStructuredFormState {
  return {
    pattern: detail.pattern,
    jlptLevel: detail.jlpt,
    title: detail.title,
    shortExplanation: detail.shortExplanation,
    detailedExplanation: detail.detailedExplanation ?? "",
    formalityLevel: detail.formalityLevel ?? "",
    difficulty: detail.difficulty ? String(detail.difficulty) : "1",
    position: detail.position ? String(detail.position) : "",
    tags: (detail.tags ?? []).join(", "),
    examples: detail.examples.map((item) => ({
      japanese: item.japanese,
      reading: item.reading,
      translation: item.translation,
      notes: item.notes,
      isNatural: item.isNatural,
    })),
  }
}

function parseInteger(value: string): number | undefined {
  if (!value.trim()) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    return undefined
  }

  return parsed
}

function getValidationMessageForInteger(
  fieldName: string,
  value: string,
  minimum: number,
  maximum?: number,
): string | null {
  if (!value.trim()) {
    return null
  }

  const parsed = parseInteger(value)
  if (parsed === undefined) {
    return `${fieldName} deve ser um número inteiro.`
  }

  if (parsed < minimum) {
    return `${fieldName} deve ser maior ou igual a ${minimum}.`
  }

  if (maximum !== undefined && parsed > maximum) {
    return `${fieldName} deve ser menor ou igual a ${maximum}.`
  }

  return null
}

function parseTagsField(raw: string): string[] | undefined {
  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  return items.length > 0 ? items : undefined
}

function buildPayload(form: GrammarStructuredFormState): {
  payload: CreateGrammarPointDto | null
  errors: FormErrors
} {
  const errors: FormErrors = {}

  if (!form.pattern.trim()) {
    errors.pattern = "Pattern é obrigatório."
  }

  if (!form.title.trim()) {
    errors.title = "Title é obrigatório."
  }

  if (!form.shortExplanation.trim()) {
    errors.shortExplanation = "Short explanation é obrigatória."
  }

  const difficultyError = getValidationMessageForInteger("Difficulty", form.difficulty, 1, 5)
  if (difficultyError) {
    errors.difficulty = difficultyError
  }

  const positionError = getValidationMessageForInteger("Position", form.position, 1)
  if (positionError) {
    errors.position = positionError
  }

  form.examples.forEach((item, index) => {
    if (!item.japanese.trim()) {
      errors[`examples[${index}].japanese`] = "Japanese é obrigatório."
    }
    if (!item.translation.trim()) {
      errors[`examples[${index}].translation`] = "Translation é obrigatória."
    }
  })

  if (Object.keys(errors).length > 0) {
    return {
      payload: null,
      errors,
    }
  }

  const payload: CreateGrammarPointDto = {
    pattern: form.pattern.trim(),
    jlptLevel: form.jlptLevel,
    title: form.title.trim(),
    shortExplanation: form.shortExplanation.trim(),
    detailedExplanation: form.detailedExplanation.trim() || undefined,
    formalityLevel: form.formalityLevel.trim() || undefined,
    difficulty: parseInteger(form.difficulty),
    position: parseInteger(form.position),
    tags: parseTagsField(form.tags),
    examples:
      form.examples.length > 0
        ? form.examples.map((item) => ({
            japanese: item.japanese.trim(),
            reading: item.reading?.trim() || null,
            translation: item.translation.trim(),
            notes: item.notes?.trim() || null,
            isNatural: item.isNatural,
          }))
        : undefined,
  }

  return {
    payload,
    errors: {},
  }
}

export default function GrammarAdminPage() {
  const router = useRouter()
  const { isAuthenticated, isAdmin, isInitializing } = useRequireAdmin()

  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [filterJlpt, setFilterJlpt] = React.useState<JLPTLevel | "ALL">("ALL")
  const [filterStatus, setFilterStatus] = React.useState<GrammarReviewStatus | "ALL">("ALL")
  const [filterTag, setFilterTag] = React.useState("")
  const [filterDifficulty, setFilterDifficulty] = React.useState<number | "ALL">("ALL")
  const [sort, setSort] = React.useState<NonNullable<GrammarListQueryParams["sort"]>>("position")
  const [order, setOrder] = React.useState<NonNullable<GrammarListQueryParams["order"]>>("asc")
  const [items, setItems] = React.useState<GrammarListItemDto[]>([])
  const [totalPages, setTotalPages] = React.useState(0)
  const [totalItems, setTotalItems] = React.useState(0)
  const [isLoadingList, setIsLoadingList] = React.useState(true)
  const [listError, setListError] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingDetail, setEditingDetail] = React.useState<GrammarDetailResponseDto | null>(null)
  const [form, setForm] = React.useState<GrammarStructuredFormState>(emptyFormState)
  const [fieldErrors, setFieldErrors] = React.useState<FormErrors>({})
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [formMessage, setFormMessage] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [filtersOpen, setFiltersOpen] = React.useState(false)

  React.useEffect(() => {
    const initialEditId = new URLSearchParams(window.location.search).get("id")
    setEditingId(initialEditId)
  }, [])

  React.useEffect(() => {
    if (isInitializing || !isAuthenticated || !isAdmin) {
      return
    }

    const controller = new AbortController()
    let isActive = true

    async function loadList() {
      try {
        setIsLoadingList(true)
        setListError(null)

        const params: GrammarListQueryParams = {
          page,
          perPage: PAGE_SIZE,
          search: search.trim() || undefined,
          sort,
          order,
        }
        if (filterJlpt !== "ALL") params.jlpt = filterJlpt
        if (filterStatus !== "ALL") params.status = filterStatus
        if (filterTag.trim()) params.tag = filterTag.trim()
        if (filterDifficulty !== "ALL") params.difficulty = filterDifficulty

        const payload = await getAdminGrammarList(params, { signal: controller.signal })

        if (isActive) {
          setItems(payload.data)
          setTotalPages(payload.pagination.pages)
          setTotalItems(payload.pagination.total)
        }
      } catch (error) {
        if (isActive && !controller.signal.aborted) {
          setItems([])
          setTotalPages(0)
          setTotalItems(0)
          setListError(getErrorMessage(error))
        }
      } finally {
        if (isActive) {
          setIsLoadingList(false)
        }
      }
    }

    loadList()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [
    page,
    search,
    filterJlpt,
    filterStatus,
    filterTag,
    filterDifficulty,
    sort,
    order,
    isInitializing,
    isAuthenticated,
    isAdmin,
  ])

  React.useEffect(() => {
    if (isInitializing || !isAuthenticated || !isAdmin) {
      return
    }

    if (editingId === null) {
      setEditingDetail(null)
      setForm(emptyFormState())
      return
    }

    const currentEditId = editingId

    const controller = new AbortController()
    let isActive = true

    async function loadDetail() {
      try {
        setIsLoadingDetail(true)
        setFormError(null)
        setFieldErrors({})
        const detail = await getAdminGrammarDetail(currentEditId, {
          signal: controller.signal,
        })
        if (isActive) {
          setEditingDetail(detail)
          setForm(detailToForm(detail))
        }
      } catch (error) {
        if (isActive && !controller.signal.aborted) {
          setEditingDetail(null)
          setFormError(getErrorMessage(error))
        }
      } finally {
        if (isActive) {
          setIsLoadingDetail(false)
        }
      }
    }

    loadDetail()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [editingId, isInitializing, isAuthenticated, isAdmin])

  async function handleSubmit() {
    try {
      setIsSaving(true)
      setFormError(null)
      setFormMessage(null)
      setFieldErrors({})

      const { payload, errors } = buildPayload(form)
      if (!payload) {
        setFieldErrors(errors)
        setFormError("Existem campos inválidos. Revise os destaques e tente novamente.")
        return
      }

      const detail = editingId
        ? await updateGrammarPoint(editingId, payload)
        : await createGrammarPoint(payload)
      setEditingId(detail.id)
      setEditingDetail(detail)
      setForm(detailToForm(detail))
      setFormMessage(
        editingId
          ? "Ponto gramatical atualizado com sucesso."
          : "Ponto gramatical criado com sucesso.",
      )
      router.replace(`/dashboard/grammar/admin?id=${detail.id}`)
      setPage(1)
    } catch (error) {
      setFormError(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!editingId) {
      return
    }

    if (!window.confirm("Remover este ponto gramatical permanentemente?")) {
      return
    }

    try {
      setIsDeleting(true)
      await deleteGrammarPoint(editingId)
      setFormMessage("Ponto gramatical removido com sucesso.")
      setEditingId(null)
      setEditingDetail(null)
      setForm(emptyFormState())
      setFieldErrors({})
      router.replace("/dashboard/grammar/admin")
      setPage(1)
    } catch (error) {
      setFormError(getErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }

  if (isInitializing) {
    return (
      <DashboardShell
        title="Admin Grammar"
        subtitle="Validando sessão administrativa"
        kanji="文"
      >
        <Card className="bg-card/60 border-border/50 max-w-xl mx-auto">
          <CardContent className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando autenticação...
          </CardContent>
        </Card>
      </DashboardShell>
    )
  }

  if (!isAuthenticated || !isAdmin) {
    return null
  }

  function startNew() {
    setEditingId(null)
    setEditingDetail(null)
    setForm(emptyFormState())
    setFieldErrors({})
    setFormError(null)
    setFormMessage(null)
    router.replace("/dashboard/grammar/admin")
  }

  return (
    <DashboardShell
      title="Admin Grammar"
      subtitle="CRUD completo sobre /admin/grammar-points"
      kanji="文"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/grammar">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
          <Button variant="outline" onClick={startNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo ponto gramatical
          </Button>
          <Button variant="outline" onClick={() => router.refresh()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Recarregar
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
          <Card className="bg-card/60 backdrop-blur border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4 text-[var(--torii-red)]" />
                Pontos gramaticais cadastrados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Buscar ponto gramatical para editar..."
                className="bg-secondary/40 border-border"
              />

              <Collapsible
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                className="w-full"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtros e ordenação
                    <Badge variant="secondary" className="ml-auto">
                      {[
                        filterJlpt !== "ALL",
                        filterStatus !== "ALL",
                        filterTag.trim() !== "",
                        filterDifficulty !== "ALL",
                        sort !== "position",
                        order !== "asc",
                      ].filter(Boolean).length}
                    </Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nível JLPT</Label>
                      <Select
                        value={filterJlpt}
                        onValueChange={(value) => {
                          setFilterJlpt(value as JLPTLevel | "ALL")
                          setPage(1)
                        }}
                      >
                        <SelectTrigger className="bg-secondary/40 border-border h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Todos</SelectItem>
                          {jlptOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={filterStatus}
                        onValueChange={(value) => {
                          setFilterStatus(value as GrammarReviewStatus | "ALL")
                          setPage(1)
                        }}
                      >
                        <SelectTrigger className="bg-secondary/40 border-border h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Todos</SelectItem>
                          {statusOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Dificuldade</Label>
                      <Select
                        value={String(filterDifficulty)}
                        onValueChange={(value) => {
                          setFilterDifficulty(
                            value === "ALL" ? "ALL" : Number(value),
                          )
                          setPage(1)
                        }}
                      >
                        <SelectTrigger className="bg-secondary/40 border-border h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Todas</SelectItem>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}/5
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Tag (exata)</Label>
                      <Input
                        value={filterTag}
                        onChange={(event) => {
                          setFilterTag(event.target.value)
                          setPage(1)
                        }}
                        placeholder="verb, te-form, estado..."
                        className="bg-secondary/40 border-border h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ordenar por</Label>
                      <div className="flex gap-2">
                        <Select
                          value={sort}
                          onValueChange={(value) => {
                            setSort(
                              value as NonNullable<
                                GrammarListQueryParams["sort"]
                              >,
                            )
                            setPage(1)
                          }}
                        >
                          <SelectTrigger className="bg-secondary/40 border-border h-9 flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {sortOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => {
                            setOrder((current) =>
                              current === "asc" ? "desc" : "asc",
                            )
                            setPage(1)
                          }}
                          title={order === "asc" ? "Crescente" : "Decrescente"}
                        >
                          {order === "asc" ? "↑" : "↓"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {listError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
                  {listError}
                </div>
              )}

              {isLoadingList ? (
                <div className="space-y-3 animate-pulse">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-20 rounded-2xl bg-muted/50" />
                  ))}
                </div>
              ) : items.length > 0 ? (
                <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setEditingId(item.id)
                        router.replace(`/dashboard/grammar/admin?id=${item.id}`)
                      }}
                      className={cn(
                        "w-full rounded-2xl border p-3 text-left transition-colors",
                        editingId === item.id
                          ? "border-[var(--torii-red)]/30 bg-[var(--torii-red)]/5"
                          : "border-border/50 bg-secondary/10 hover:bg-secondary/20",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center shrink-0">
                            <span className="font-japanese text-xs text-foreground text-center leading-tight">
                              {item.pattern.slice(0, 6)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-foreground truncate">
                                {item.title}
                              </p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "border text-[10px] px-1.5 py-0",
                                  statusBadgeVariant[item.reviewStatus],
                                )}
                              >
                                {item.reviewStatus}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {item.jlpt} · {item.pattern}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline">Dif {item.difficulty}/5</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            #{item.position}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum ponto gramatical encontrado com os filtros atuais.
                </p>
              )}

              <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
                <span>Total {totalItems.toLocaleString("pt-BR")}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((currentPage) => Math.max(1, currentPage - 1))
                    }
                  >
                    Anterior
                  </Button>
                  <Badge variant="outline">
                    {page}/{Math.max(totalPages, 1)}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || totalPages === 0}
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-[var(--torii-red)]" />
                {editingId
                  ? `Editando ${editingDetail?.pattern ?? editingId}`
                  : "Criar ponto gramatical"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
                  {formError}
                </div>
              )}
              {formMessage && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-muted-foreground">
                  {formMessage}
                </div>
              )}

              {isLoadingDetail && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando detalhe...
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Pattern" error={fieldErrors.pattern}>
                  <Input
                    value={form.pattern}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, pattern: event.target.value }))
                    }
                    className="bg-secondary/40 border-border"
                  />
                </Field>
                <Field label="JLPT" error={fieldErrors.jlptLevel}>
                  <Select
                    value={form.jlptLevel}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, jlptLevel: value as JLPTLevel }))
                    }
                  >
                    <SelectTrigger className="bg-secondary/40 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {jlptOptions.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Title" error={fieldErrors.title}>
                  <Input
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                    className="bg-secondary/40 border-border"
                  />
                </Field>
                <Field label="Formality level" error={fieldErrors.formalityLevel}>
                  <Input
                    value={form.formalityLevel}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        formalityLevel: event.target.value,
                      }))
                    }
                    className="bg-secondary/40 border-border"
                  />
                </Field>
                <Field label="Difficulty (1-5)" error={fieldErrors.difficulty}>
                  <Input
                    value={form.difficulty}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, difficulty: event.target.value }))
                    }
                    className="bg-secondary/40 border-border"
                  />
                </Field>
                <Field label="Position" error={fieldErrors.position}>
                  <Input
                    value={form.position}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, position: event.target.value }))
                    }
                    className="bg-secondary/40 border-border"
                  />
                </Field>
                <Field label="Tags (separadas por vírgula)" error={fieldErrors.tags}>
                  <Input
                    value={form.tags}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, tags: event.target.value }))
                    }
                    className="bg-secondary/40 border-border"
                  />
                </Field>
              </div>

              <Field label="Short explanation" error={fieldErrors.shortExplanation}>
                <Textarea
                  value={form.shortExplanation}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      shortExplanation: event.target.value,
                    }))
                  }
                  rows={2}
                  className="bg-secondary/40 border-border resize-none"
                />
              </Field>

              <Field label="Detailed explanation" error={fieldErrors.detailedExplanation}>
                <Textarea
                  value={form.detailedExplanation}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      detailedExplanation: event.target.value,
                    }))
                  }
                  rows={4}
                  className="bg-secondary/40 border-border resize-none"
                />
              </Field>

              <ExamplesSection
                values={form.examples}
                onChange={(examples) => setForm((current) => ({ ...current, examples }))}
                errorsMap={fieldErrors}
                showSource={false}
                showNotes
                showIsNatural
              />

              <div className="flex flex-wrap gap-3 pt-2">
                <Button onClick={handleSubmit} disabled={isSaving || isLoadingDetail}>
                  <Check className="h-4 w-4 mr-2" />
                  {editingId ? "Salvar alterações" : "Criar ponto gramatical"}
                </Button>
                {editingId && (
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                )}
                <Button variant="outline" onClick={startNew}>
                  Limpar formulário
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </DashboardShell>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  )
}
