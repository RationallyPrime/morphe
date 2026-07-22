from __future__ import annotations

from typing import Annotated, ClassVar, Literal, Self, Union

from pydantic import (
    BaseModel,
    ConfigDict,
    StrictBool,
    StrictFloat,
    StrictInt,
    StrictStr,
    TypeAdapter,
    field_validator,
    model_validator,
)
from pydantic import Field as PydanticField

from .labels import VISIBLE_LABEL_PATTERN

type NumberValue = StrictInt | StrictFloat
type JsonValue = None | bool | NumberValue | str | list[JsonValue] | dict[str, JsonValue]
type ParamValue = JsonValue | Node

type ContainerRole = Literal[
    "page",
    "section",
    "panel",
    "toolbar",
    "list",
    "form",
    "field-group",
    "inline",
]
type Density = Literal["compact", "regular", "spacious"]
type EmphasisClaim = Literal["muted", "normal", "strong", "critical"]
type GridColumn = Literal["flexible", "content"]
type CoreIntent = Literal[
    "primary-action",
    "neutral",
    "provenance",
    "evidence",
    "accession",
    "caution",
    "success",
    "info",
]
type RegisterIntent = Literal["folio", "marginalia", "seal"]
type IntentRef = CoreIntent | RegisterIntent


class GrammarModel(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(
        allow_inf_nan=False,
        extra="forbid",
        frozen=True,
        populate_by_name=True,
    )

    @model_validator(mode="before")
    @classmethod
    def reject_explicit_null_fields(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data
        null_fields = [key for key, value in data.items() if value is None]
        if null_fields:
            joined = ", ".join(sorted(str(field) for field in null_fields))
            msg = f"optional fields must be omitted instead of null: {joined}"
            raise ValueError(msg)
        return data


class VisibleLabelRelation(GrammarModel):
    mode: Literal["visible"]
    text: StrictStr


class AriaLabelRelation(GrammarModel):
    mode: Literal["aria-label"]
    text: StrictStr


class LabelledByRelation(GrammarModel):
    mode: Literal["labelledby"]
    id: StrictStr


type LabelRelation = Annotated[
    VisibleLabelRelation | AriaLabelRelation | LabelledByRelation,
    PydanticField(discriminator="mode"),
]


class InputA11y(GrammarModel):
    id: StrictStr
    label: LabelRelation
    describedBy: StrictStr | None = None
    required: StrictBool | None = None


class StatusSignal(GrammarModel):
    text: StrictStr
    icon: StrictStr | None = None


class Stack(GrammarModel):
    kind: Literal["stack"]
    role: ContainerRole
    direction: Literal["block", "inline", "auto"] | None = None
    indent: NumberValue | None = None
    emphasis: EmphasisClaim | None = None
    children: tuple[Node, ...]


class Grid(GrammarModel):
    kind: Literal["grid"]
    role: ContainerRole
    minTrack: Literal["narrow", "regular", "wide"] | None = None
    columns: tuple[GridColumn, ...] | None = None
    ruled: StrictBool | None = None
    emphasis: EmphasisClaim | None = None
    children: tuple[Node, ...]


class Cluster(GrammarModel):
    kind: Literal["cluster"]
    role: ContainerRole
    justify: Literal["start", "center", "end", "between"] | None = None
    align: Literal["start", "center", "end", "baseline"] | None = None
    emphasis: EmphasisClaim | None = None
    children: tuple[Node, ...]


class Frame(GrammarModel):
    kind: Literal["frame"]
    role: ContainerRole
    surface: Literal["base", "raised", "sunken"] | None = None
    density: Density | None = None
    budget: NumberValue | None = None
    children: tuple[Node, ...]


class Spacer(GrammarModel):
    kind: Literal["spacer"]
    size: Literal["xs", "sm", "md", "lg", "xl"] | None = None


class TableColumn(GrammarModel):
    header: StrictStr = PydanticField(min_length=1, pattern=VISIBLE_LABEL_PATTERN)
    numeric: StrictBool | None = None
    priority: Literal["primary", "secondary", "detail"] | None = None
    intent: IntentRef | None = None


class TableCell(GrammarModel):
    children: tuple[Node, ...]


class TableRow(GrammarModel):
    cells: tuple[TableCell, ...]
    # The row-associated diagnostics lane (ADR-0020): full-width, immediately
    # after its row, so an alert explains its subject without painting over it.
    diagnostics: tuple[Node, ...] | None = None


class Table(GrammarModel):
    # ADR-0020: the data-table capability. Real <table>/<th scope> semantics,
    # a required accessible name, and a DECLARED responsive policy — never a
    # geometry that appears to fit while the information does not.
    kind: Literal["table"]
    caption: StrictStr = PydanticField(min_length=1, pattern=VISIBLE_LABEL_PATTERN)
    captionHidden: StrictBool | None = None
    columns: tuple[TableColumn, ...] = PydanticField(min_length=1)
    rows: tuple[TableRow, ...]
    rowHeader: StrictBool | None = None
    responsive: Literal["scroll", "collapse", "records"] | None = None
    sticky: StrictBool | None = None
    emphasis: EmphasisClaim | None = None

    @model_validator(mode="after")
    def require_rectangular_rows(self) -> Self:
        width = len(self.columns)
        for index, row in enumerate(self.rows):
            if len(row.cells) != width:
                msg = (
                    f"table row {index} carries {len(row.cells)} cells; "
                    f"the declared columns require exactly {width}"
                )
                raise ValueError(msg)
        return self


class Text(GrammarModel):
    kind: Literal["text"]
    value: StrictStr
    as_: Literal["display", "heading", "subheading", "body", "caption"] | None = PydanticField(
        default=None,
        alias="as",
    )
    # Visual register and document-outline level are deliberately independent.
    # Existing trees keep their fixed point (display -> h1, heading -> h2,
    # subheading -> h3); an explicit level lets an operational pane use the
    # restrained ``heading`` register for its one logical h1 without borrowing
    # editorial ``display`` typography (ADR-0021 / KRA-798).
    level: Literal[1, 2, 3] | None = None
    emphasis: EmphasisClaim | None = None
    intent: IntentRef | None = None
    clamp: NumberValue | None = None
    numeric: StrictBool | None = None
    polarity: Literal["positive", "negative"] | None = None

    @field_validator("level", mode="before")
    @classmethod
    def require_integer_heading_level(cls, value: object) -> object:
        # ``bool`` is an ``int`` subclass in Python; without this boundary the
        # Python authority accepted ``true`` as level 1 while JSON Schema/TS
        # correctly rejected it. Keep the three runtimes byte-contract aligned.
        if value is not None and (type(value) is not int or value not in {1, 2, 3}):
            msg = "level must be the integer 1, 2, or 3"
            raise ValueError(msg)
        return value


class NumberNode(GrammarModel):
    kind: Literal["number"]
    value: NumberValue
    format: Literal["plain", "integer", "currency", "percent", "compact"] | None = None
    currency: StrictStr | None = None
    emphasis: EmphasisClaim | None = None
    intent: IntentRef | None = None


class Badge(GrammarModel):
    kind: Literal["badge"]
    label: StrictStr
    intent: IntentRef | None = None
    icon: StrictStr | None = None


class DecorativeIconA11y(GrammarModel):
    role: Literal["decorative"]


class ImageIconA11y(GrammarModel):
    role: Literal["img"]
    label: StrictStr


type IconA11y = Annotated[
    DecorativeIconA11y | ImageIconA11y,
    PydanticField(discriminator="role"),
]


class Icon(GrammarModel):
    kind: Literal["icon"]
    name: StrictStr
    a11y: IconA11y
    intent: IntentRef | None = None


class MediaSource(GrammarModel):
    type: StrictStr
    srcset: StrictStr


class TrendPoint(GrammarModel):
    period: StrictStr = PydanticField(min_length=1)
    value: NumberValue


class Trend(GrammarModel):
    # ADR-0019: the series Content kind. `summary` is the REQUIRED paired text —
    # the figure is aria-hidden; the words are the primary channel, the shape is
    # never the only signal. `baseline` is authored geometric honesty: "zero"
    # (default) draws proportional truth; "min" is the explicit variation lens.
    kind: Literal["trend"]
    points: tuple[TrendPoint, ...]
    summary: StrictStr = PydanticField(min_length=1, pattern=VISIBLE_LABEL_PATTERN)
    baseline: Literal["zero", "min"] | None = None
    intent: IntentRef | None = None
    emphasis: EmphasisClaim | None = None


class Media(GrammarModel):
    kind: Literal["media"]
    src: StrictStr
    alt: StrictStr
    aspect: Literal["square", "video", "portrait", "auto"] | None = None
    sources: tuple[MediaSource, ...] | None = None
    sizes: StrictStr | None = None
    width: NumberValue | None = None
    height: NumberValue | None = None
    eager: StrictBool | None = None


class Field(GrammarModel):
    kind: Literal["field"]
    a11y: InputA11y
    inputType: Literal["text", "email", "password", "number", "search", "tel", "url"] | None = None
    placeholder: StrictStr | None = None
    bind: StrictStr | None = None
    hint: StrictStr | None = None
    error: StrictStr | None = None
    multiline: StrictBool | None = None
    rows: NumberValue | None = None
    resizable: StrictBool | None = None


class SelectOption(GrammarModel):
    value: StrictStr
    label: StrictStr
    disabled: StrictBool | None = None


class Select(GrammarModel):
    kind: Literal["select"]
    a11y: InputA11y
    options: tuple[SelectOption, ...]
    bind: StrictStr | None = None
    hint: StrictStr | None = None
    error: StrictStr | None = None
    variant: Literal["dropdown", "radiogroup"] | None = None


class Toggle(GrammarModel):
    kind: Literal["toggle"]
    a11y: InputA11y
    bind: StrictStr | None = None
    hint: StrictStr | None = None
    variant: Literal["switch", "checkbox"] | None = None
    indeterminate: StrictBool | None = None


class Range(GrammarModel):
    kind: Literal["range"]
    a11y: InputA11y
    min: NumberValue
    max: NumberValue
    step: NumberValue | None = None
    bind: StrictStr | None = None
    hint: StrictStr | None = None


class Progress(GrammarModel):
    kind: Literal["progress"]
    value: NumberValue | None = None
    label: StrictStr
    intent: IntentRef | None = None


class Status(GrammarModel):
    kind: Literal["status"]
    tone: Literal["success", "caution", "info", "neutral"]
    signal: StatusSignal
    href: StrictStr | None = None


class InlineAlert(GrammarModel):
    kind: Literal["inline-alert"]
    tone: Literal["success", "caution", "info"]
    title: StrictStr
    detail: StrictStr | None = None
    # The producer-authored next action (KRA-757 §3.8 / KRA-788): a kernel's
    # `Diagnostic.repair_hint` renders as honest structure, never concatenated
    # into `detail` where the machine detail and the human action would blur.
    repair: StrictStr | None = None
    live: Literal["polite", "assertive"] | None = None
    href: StrictStr | None = None


class AriaControlLabel(GrammarModel):
    mode: Literal["aria-label"]
    text: StrictStr


class LabelledByControlLabel(GrammarModel):
    mode: Literal["labelledby"]
    id: StrictStr


type ControlLabel = Annotated[
    AriaControlLabel | LabelledByControlLabel,
    PydanticField(discriminator="mode"),
]


class Button(GrammarModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(
        json_schema_extra={
            "anyOf": [
                {"required": ["label"]},
                {"required": ["a11y"]},
            ]
        }
    )

    kind: Literal["button"]
    variant: Literal["solid", "outline", "ghost"] | None = None
    intent: IntentRef | None = None
    type: Literal["button", "submit", "reset"] | None = None
    disabled: StrictBool | None = None
    busy: StrictBool | None = None
    action: StrictStr | None = None
    icon: StrictStr | None = None
    id: StrictStr | None = None
    label: StrictStr | None = None
    a11y: ControlLabel | None = None

    @model_validator(mode="after")
    def require_accessible_name(self) -> Self:
        if self.label is None and self.a11y is None:
            msg = "button requires visible label or explicit a11y name"
            raise ValueError(msg)
        return self


class Link(GrammarModel):
    kind: Literal["link"]
    href: StrictStr
    label: StrictStr
    intent: IntentRef | None = None
    external: Literal["auto", "force", "hide"] | None = None


class Dialog(GrammarModel):
    kind: Literal["dialog"]
    title: StrictStr
    description: StrictStr | None = None
    open: StrictBool | None = None
    bind: StrictStr | None = None
    dismissable: StrictBool | None = None
    children: tuple[Node, ...]


class Popover(GrammarModel):
    kind: Literal["popover"]
    anchor: StrictStr
    id: StrictStr
    placement: Literal["top", "bottom", "start", "end"] | None = None
    role: Literal["tooltip", "menu", "listbox"] | None = None
    open: StrictBool | None = None
    bind: StrictStr | None = None
    children: tuple[Node, ...]


class Disclosure(GrammarModel):
    kind: Literal["disclosure"]
    summary: StrictStr
    open: StrictBool | None = None
    group: StrictStr | None = None
    children: tuple[Node, ...]


class Slot(GrammarModel):
    kind: Literal["slot"]
    name: StrictStr
    fallback: tuple[Node, ...] | None = None


class ParamRef(GrammarModel):
    kind: Literal["param-ref"]
    param: StrictStr


class Vary(GrammarModel):
    kind: Literal["vary"]
    id: StrictStr
    options: tuple[Node, ...]
    default: NumberValue | None = None
    objective: Literal["salience", "density", "compactness"] | None = None


class Within(GrammarModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(
        json_schema_extra={
            # Repeat the exact allowed object shapes instead of using if/then: the package's
            # generated-schema runtime supports unions but deliberately rejects conditionals.
            "oneOf": [
                {
                    "type": "object",
                    "properties": {
                        "kind": {},
                        "id": {},
                        "dimension": {},
                        "range": {},
                        "default": {},
                    },
                    "required": ["kind", "id", "dimension", "range", "default"],
                    "additionalProperties": False,
                },
                {
                    "type": "object",
                    "properties": {
                        "kind": {},
                        "id": {},
                        "dimension": {"const": "density"},
                        "range": {},
                        "default": {},
                        "target": {"type": "object"},
                    },
                    "required": ["kind", "id", "dimension", "range", "default", "target"],
                    "additionalProperties": False,
                },
                {
                    "type": "object",
                    "properties": {
                        "kind": {},
                        "id": {},
                        "dimension": {"const": "emphasis"},
                        "range": {},
                        "default": {},
                        "target": {"type": "object"},
                    },
                    "required": ["kind", "id", "dimension", "range", "default", "target"],
                    "additionalProperties": False,
                },
                {
                    "type": "object",
                    "properties": {
                        "kind": {},
                        "id": {},
                        "dimension": {"const": "collapse"},
                        "range": {},
                        "default": {},
                        "target": {"type": "object"},
                        "summary": {
                            "type": "string",
                            "minLength": 1,
                            "pattern": VISIBLE_LABEL_PATTERN,
                        },
                    },
                    "required": [
                        "kind",
                        "id",
                        "dimension",
                        "range",
                        "default",
                        "target",
                        "summary",
                    ],
                    "additionalProperties": False,
                },
            ]
        }
    )

    kind: Literal["within"]
    id: StrictStr
    dimension: Literal["density", "emphasis", "collapse"]
    range: tuple[NumberValue, NumberValue]
    default: NumberValue
    target: Node | None = None
    summary: StrictStr | None = PydanticField(
        default=None,
        min_length=1,
        pattern=VISIBLE_LABEL_PATTERN,
    )

    @model_validator(mode="after")
    def require_accessible_collapse_target(self) -> Self:
        if self.target is not None and self.dimension == "collapse" and self.summary is None:
            msg = "targeted collapse within requires a visibly non-blank summary"
            raise ValueError(msg)
        if self.summary is not None and (self.target is None or self.dimension != "collapse"):
            msg = "within summary is only valid for a targeted collapse"
            raise ValueError(msg)
        return self


class CompoundRef(GrammarModel):
    kind: Literal["compound"]
    name: StrictStr
    args: dict[str, ParamValue]
    emphasis: EmphasisClaim | None = None
    slots: dict[str, tuple[Node, ...]] | None = None


type Node = Annotated[
    Union[  # noqa: UP007 - KRA-314 requires Annotated[Union[...], Field(...)].
        Stack,
        Grid,
        Cluster,
        Frame,
        Spacer,
        Table,
        Text,
        NumberNode,
        Badge,
        Icon,
        Trend,
        Media,
        Field,
        Select,
        Toggle,
        Range,
        Progress,
        Status,
        InlineAlert,
        Button,
        Link,
        Dialog,
        Popover,
        Disclosure,
        Slot,
        ParamRef,
        Vary,
        Within,
        CompoundRef,
    ],
    PydanticField(discriminator="kind"),
]

MODEL_TYPES: tuple[type[GrammarModel], ...] = (
    VisibleLabelRelation,
    AriaLabelRelation,
    LabelledByRelation,
    InputA11y,
    StatusSignal,
    Stack,
    Grid,
    Cluster,
    Frame,
    Spacer,
    TableColumn,
    TableCell,
    TableRow,
    Table,
    Text,
    NumberNode,
    Badge,
    DecorativeIconA11y,
    ImageIconA11y,
    Icon,
    TrendPoint,
    Trend,
    MediaSource,
    Media,
    Field,
    SelectOption,
    Select,
    Toggle,
    Range,
    Progress,
    Status,
    InlineAlert,
    AriaControlLabel,
    LabelledByControlLabel,
    Button,
    Link,
    Dialog,
    Popover,
    Disclosure,
    Slot,
    ParamRef,
    Vary,
    Within,
    CompoundRef,
)


def rebuild_models() -> None:
    types_namespace = {"JsonValue": JsonValue, "Node": Node, "ParamValue": ParamValue}
    for model_type in MODEL_TYPES:
        model_type.model_rebuild(_types_namespace=types_namespace)


rebuild_models()

NODE_ADAPTER: TypeAdapter[Node] = TypeAdapter(Node)


def validate_node(payload: object) -> Node:
    return NODE_ADAPTER.validate_python(payload)
