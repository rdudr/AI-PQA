import React from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { Copy, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CodeViewerProps {
  code: string
  language?: string
  title?: string
  showLineNumbers?: boolean
}

export function CodeViewer({
  code,
  language = 'javascript',
  title = 'Code',
  showLineNumbers = true,
}: CodeViewerProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border border-[#10375c]/20 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold text-[#10375c]">{title}</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 w-8 p-0"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4 text-[#10375c]" />
          )}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <SyntaxHighlighter
            language={language}
            style={atomOneDark}
            showLineNumbers={showLineNumbers}
            wrapLines
            className="!m-0 !rounded-none !bg-[#282c34]"
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </CardContent>
    </Card>
  )
}

export function LogViewer({
  logs,
  title = 'Logs',
  maxLines = 100,
}: {
  logs: string[]
  title?: string
  maxLines?: number
}) {
  const displayLogs = logs.slice(-maxLines)
  const logText = displayLogs.join('\n')

  return <CodeViewer code={logText} language="text" title={title} showLineNumbers={false} />
}
