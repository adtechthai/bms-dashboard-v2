'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type TimeFrame = 'today' | '7days' | '30days'

interface MetricData {
  totalChat: number
  totalLead: number
  totalBuy: number
  totalBuyValue: number
  totalGoodCustomer: number
  totalViewContent: number
  totalAddToCart: number
  totalInitiateCheckout: number
  totalBadCustomer: number
  totalSpam: number
  totalBlocking: number
  totalBan: number
}

interface ChartData {
  period: string
  totalChat: number
  totalLead: number
  totalBuy: number
  totalBuyValue: number
  conversionRate: number
}

interface PsidInputsStatistics {
  id: number
  today_count: number
  weekly_count: number
  monthly_count: number
  created_at: string
}

interface IntentStatistics {
  id: number
  intent_type: string
  today_count: number
  weekly_count: number
  monthly_count: number
  total_count: number
}

interface TrendData {
  name: string
  totalChat: number
  totalLead: number
  totalBuy: number
}

export default function BMSDashboard() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('today')
  const [metrics, setMetrics] = useState<MetricData>({
    totalChat: 0,
    totalLead: 0,
    totalBuy: 0,
    totalBuyValue: 0,
    totalGoodCustomer: 0,
    totalViewContent: 0,
    totalAddToCart: 0,
    totalInitiateCheckout: 0,
    totalBadCustomer: 0,
    totalSpam: 0,
    totalBlocking: 0,
    totalBan: 0
  })
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState('')

  const fetchHistoricalData = async () => {
    setChartLoading(true)
    try {
      const countColumn = timeFrame === 'today' ? 'today_count' : 
                         timeFrame === '7days' ? 'weekly_count' : 'monthly_count'

      // Fetch PSID Inputs (Total Chat)
      const { data: psidData } = await supabase
        .from('psid_inputs_statistics')
        .select(countColumn)
        .eq('metric_type', 'PSID Inputs')
        .single()

      // Fetch Intent Statistics for Lead and Purchase
      const { data: intentData } = await supabase
        .from('intent_statistics')
        .select(`intent_type, ${countColumn}`)
        .in('intent_type', ['Lead', 'Purchase'])

      const totalChat = psidData?.[countColumn as keyof typeof psidData] || 0
      let totalLead = 0
      let totalBuy = 0

      // Process intent statistics
      if (intentData) {
        intentData.forEach(item => {
          const count = item[countColumn as keyof typeof item] || 0
          if (item.intent_type === 'Lead') {
            totalLead = count
          } else if (item.intent_type === 'Purchase') {
            totalBuy = count
          }
        })
      }

      // Create pie chart data
      const total = totalChat + totalLead + totalBuy
      const chartData = [
        {
          name: 'Total Chat',
          value: totalChat,
          percentage: total > 0 ? ((totalChat / total) * 100).toFixed(1) : '0.0'
        },
        {
          name: 'Total Lead',
          value: totalLead,
          percentage: total > 0 ? ((totalLead / total) * 100).toFixed(1) : '0.0'
        },
        {
          name: 'Total Buy',
          value: totalBuy,
          percentage: total > 0 ? ((totalBuy / total) * 100).toFixed(1) : '0.0'
        }
      ]

      setChartData(chartData)
    } catch (error) {
      console.error('Error fetching historical data:', error)
    } finally {
      setChartLoading(false)
    }
  }

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const countColumn = timeFrame === 'today' ? 'today_count' : 
                         timeFrame === '7days' ? 'weekly_count' : 'monthly_count'

      // Fetch PSID Inputs (Total Chat)
      const { data: psidData } = await supabase
        .from('psid_inputs_statistics')
        .select(countColumn)
        .eq('metric_type', 'PSID Inputs')
        .single()

      // Fetch Intent Statistics
      const { data: intentData } = await supabase
        .from('intent_statistics')
        .select(`intent_type, ${countColumn}`)

      // Fetch Purchase Value
      const { data: purchaseData } = await supabase
        .from('purchase')
        .select('value')

      const totalChat = psidData?.[countColumn as keyof typeof psidData] || 0
      let totalLead = 0
      let totalBuy = 0
      let totalViewContent = 0
      let totalAddToCart = 0
      let totalInitiateCheckout = 0
      let totalSpam = 0
      let totalBlocking = 0
      let totalBan = 0

      // Process intent statistics
      if (intentData) {
        intentData.forEach(item => {
          const count = item[countColumn as keyof typeof item] || 0
          switch (item.intent_type) {
            case 'Lead':
              totalLead += count
              break
            case 'Purchase':
              totalBuy += count
              break
            case 'VC':
              totalViewContent += count
              break
            case 'ATC':
              totalAddToCart += count
              break
            case 'IC':
              totalInitiateCheckout += count
              break
            case 'Move to Spam':
              totalSpam += count
              break
            case 'Blocking':
              totalBlocking += count
              break
            case 'Ban':
              totalBan += count
              break
          }
        })
      }

      // Calculate totals
      const totalGoodCustomer = totalAddToCart + totalInitiateCheckout + totalLead + totalBuy + totalViewContent
      const totalBadCustomer = totalBan + totalBlocking + totalSpam
      const totalBuyValue = purchaseData?.reduce((sum, item) => sum + (item.value || 0), 0) || 0

      setMetrics({
        totalChat,
        totalLead,
        totalBuy,
        totalBuyValue,
        totalGoodCustomer,
        totalViewContent,
        totalAddToCart,
        totalInitiateCheckout,
        totalBadCustomer,
        totalSpam,
        totalBlocking,
        totalBan
      })
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    fetchHistoricalData()
    fetchTrendAnalysisData()
    
    // Optional: Set up real-time subscription
    const subscription = supabase
      .channel('trend-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'psid_inputs_statistics' },
        () => fetchTrendAnalysisData()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'intent_statistics' },
        () => fetchTrendAnalysisData()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [timeFrame]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Set initial time
    setCurrentTime(new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }))
    
    // Update time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }))
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const fetchTrendAnalysisData = async () => {
    try {
      // 1. ดึงข้อมูล Total Chat จาก psid_inputs_statistics
      const { data: chatData, error: chatError } = await supabase
        .from('psid_inputs_statistics')
        .select('today_count, weekly_count, monthly_count')
        .single()

      if (chatError) throw chatError

      // 2. ดึงข้อมูล Total Lead จาก intent_statistics
      const { data: leadData, error: leadError } = await supabase
        .from('intent_statistics')
        .select('today_count, weekly_count, monthly_count')
        .eq('intent_type', 'Lead')
        .single()

      if (leadError) throw leadError

      // 3. ดึงข้อมูล Total Buy (Purchase) จาก intent_statistics
      const { data: buyData, error: buyError } = await supabase
        .from('intent_statistics')
        .select('today_count, weekly_count, monthly_count')
        .eq('intent_type', 'Purchase')
        .single()

      if (buyError) throw buyError

      // 4. จัดรูปแบบข้อมูลสำหรับ BarChart
      const trendData: TrendData[] = [
        {
          name: 'Today',
          totalChat: chatData?.today_count || 0,
          totalLead: leadData?.today_count || 0,
          totalBuy: buyData?.today_count || 0
        },
        {
          name: '7 Days (Exclude Today)',
          totalChat: chatData?.weekly_count || 0,
          totalLead: leadData?.weekly_count || 0,
          totalBuy: buyData?.weekly_count || 0
        },
        {
          name: '30 Days (Exclude Today)',
          totalChat: chatData?.monthly_count || 0,
          totalLead: leadData?.monthly_count || 0,
          totalBuy: buyData?.monthly_count || 0
        }
      ]

      setTrendData(trendData)
      
    } catch (error) {
      console.error('Error fetching trend analysis data:', error)
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('th-TH').format(num)
  }

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(num)
  }

  const calculatePercentage = (numerator: number, denominator: number): number => {
    if (denominator === 0) return 0
    return Math.round((numerator / denominator) * 100)
  }

  const MetricCard = ({ title, value, isPercentage = false, isCurrency = false, color = 'blue' }: {
    title: string
    value: number
    isPercentage?: boolean
    isCurrency?: boolean
    color?: 'blue' | 'green' | 'emerald' | 'red'
  }) => {
    const colorClasses = {
      blue: 'border-blue-500 bg-blue-50',
      green: 'border-green-500 bg-green-50',
      emerald: 'border-emerald-500 bg-emerald-50',
      red: 'border-red-500 bg-red-50'
    }
    
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 border-l-4 ${colorClasses[color]} hover:shadow-xl transition-shadow duration-200`}>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 mb-1">
          {loading ? (
            <span className="animate-pulse">...</span>
          ) : (
            isCurrency ? formatCurrency(value) :
            isPercentage ? `${value}%` : 
            formatNumber(value)
          )}
        </p>
        {!loading && (
          <div className="flex items-center text-xs text-gray-500 mt-2">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
              color === 'blue' ? 'bg-blue-500' :
              color === 'green' ? 'bg-green-500' :
              color === 'emerald' ? 'bg-emerald-500' :
              'bg-red-500'
            }`}></span>
            {timeFrame === 'today' ? 'Today' : 
             timeFrame === '7days' ? '7 Days' : 
             '30 Days'} data
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">BMS Dashboard</h1>
              <p className="text-gray-600">Business Metrics & Analytics</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Bangkok Time (GMT+7)</p>
              <p className="text-sm font-medium text-gray-700">
                {currentTime || '--:--:--'}
              </p>
            </div>
          </div>
          
          {/* Timeframe Filter */}
          <div className="flex space-x-2 bg-white p-2 rounded-lg shadow-sm">
            {(['today', '7days', '30days'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeFrame(tf)}
                className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
                  timeFrame === tf
                    ? 'bg-blue-600 text-white shadow-md transform scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                }`}
              >
                {tf === 'today' ? 'Today' : 
                 tf === '7days' ? '7 Days' : 
                 '30 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Charts Section */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Trend Analysis</h2>
            
            {/* Primary Metrics Chart */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Performance Overview</h3>
              <div className="h-96">
                {chartLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percentage }) => `${name}: ${value} (${percentage}%)`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={
                              entry.name === 'Total Chat' ? '#3B82F6' :
                              entry.name === 'Total Lead' ? '#10B981' :
                              '#F59E0B'
                            } 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value, name) => [
                          `${value} (${chartData.find(item => item.name === name)?.percentage}%)`,
                          name
                        ]}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }}
                        formatter={(value, entry) => `${value}: ${entry.payload.value} (${entry.payload.percentage}%)`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Metrics Grid */}
        <div className="space-y-6">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard title="Total Chat" value={metrics.totalChat} />
            <MetricCard title="Total Lead" value={metrics.totalLead} />
            <MetricCard title="Total Buy" value={metrics.totalBuy} />
            <MetricCard title="Total Buy Value" value={metrics.totalBuyValue} isCurrency={true} />
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard 
              title="Chat to Lead %" 
              value={calculatePercentage(metrics.totalLead, metrics.totalChat)} 
              isPercentage={true}
              color="green"
            />
            <MetricCard 
              title="Lead to Buy %" 
              value={calculatePercentage(metrics.totalBuy, metrics.totalLead)} 
              isPercentage={true}
              color="green"
            />
            <MetricCard 
              title="Chat to Buy %" 
              value={calculatePercentage(metrics.totalBuy, metrics.totalChat)} 
              isPercentage={true}
              color="green"
            />
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard title="Total Good Customer" value={metrics.totalGoodCustomer} color="emerald" />
            <MetricCard title="Total ViewContent" value={metrics.totalViewContent} color="emerald" />
            <MetricCard title="Total AddToCart" value={metrics.totalAddToCart} color="emerald" />
            <MetricCard title="Total Initiate Checkout" value={metrics.totalInitiateCheckout} color="emerald" />
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard title="Total Bad Customer" value={metrics.totalBadCustomer} color="red" />
            <MetricCard title="Total Spam" value={metrics.totalSpam} color="red" />
            <MetricCard title="Total Blocking" value={metrics.totalBlocking} color="red" />
            <MetricCard title="Total Ban" value={metrics.totalBan} color="red" />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span>Live Data</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <span>Bangkok Time (GMT+7)</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                <span>Auto-refresh every 5 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}