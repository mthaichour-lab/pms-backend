{{- define "pms-backend.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- define "pms-backend.fullname" -}}
{{- default (include "pms-backend.name" .) .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- define "pms-backend.labels" -}}
app.kubernetes.io/name: {{ include "pms-backend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: pms-backend
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
{{- define "pms-backend.image" -}}
{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}
{{- end }}
{{- define "pms-backend.env" -}}
- name: DATABASE_URL
  valueFrom: { secretKeyRef: { name: {{ .Values.secretName }}, key: database-url } }
- name: RABBITMQ_URL
  valueFrom: { secretKeyRef: { name: {{ .Values.secretName }}, key: rabbitmq-url } }
- name: RABBITMQ_EVENTS_EXCHANGE
  value: {{ .Values.config.rabbitmqEventsExchange | quote }}
{{- end }}
