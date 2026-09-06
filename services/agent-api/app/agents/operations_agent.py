"""
The operations agent: a chat loop that can call tools to fetch real data.
We send the user's message + the menu of tools to the model. If the model asks
to call a tool, we run it, feed the result back, and ask again — looping until
the model replies with plain text instead of a tool call.
"""
#regular imports
import json

#same directory imports
from .prompts import build_system_prompt

#different directory imports
from ..auth import CurrentUser
from ..openai_client import get_openai_client
from ..tools.drivers import (
    GET_DRIVER_ATTENDANCE_TOOL,
    GET_DRIVER_TOOL,
    LIST_DRIVERS_TOOL,
    run_get_driver,
    run_get_driver_attendance,
    run_list_drivers,
)
from ..tools.schedules import (
    GET_DRIVER_SCHEDULE_TOOL,
    GET_SCHEDULE_TOOL,
    GET_WEEK_SCHEDULE_TOOL,
    run_get_driver_schedule,
    run_get_schedule,
    run_get_week_schedule,
)
from ..tools.timeoff import (
    GET_MAKEUP_DAYS_TOOL,
    GET_TIME_OFF_TOOL,
    run_get_makeup_days,
    run_get_time_off,
)
from ..tools.staffing import (
    FIND_AVAILABLE_DRIVERS_TOOL,
    GET_STAFFING_GAPS_TOOL,
    run_find_available_drivers,
    run_get_staffing_gaps,
)
from ..tools.dailyreport import (
    GET_DAILY_REPORT_TOOL,
    GET_OPEN_ISSUES_TOOL,
    GET_RESCUES_TOOL,
    run_get_daily_report,
    run_get_open_issues,
    run_get_rescues,
)
from ..tools.payroll import GET_PAYROLL_WEEK_TOOL, run_get_payroll_week

MODEL = "gemini-flash-latest"

#how many earlier turns to replay so the model has context without ballooning cost
MAX_HISTORY_TURNS = 10

#list out any new functions here
TOOLS = [
    LIST_DRIVERS_TOOL,
    GET_DRIVER_TOOL,
    GET_DRIVER_ATTENDANCE_TOOL,
    GET_SCHEDULE_TOOL,
    GET_WEEK_SCHEDULE_TOOL,
    GET_DRIVER_SCHEDULE_TOOL,
    GET_TIME_OFF_TOOL,
    GET_MAKEUP_DAYS_TOOL,
    FIND_AVAILABLE_DRIVERS_TOOL,
    GET_STAFFING_GAPS_TOOL,
    GET_DAILY_REPORT_TOOL,
    GET_OPEN_ISSUES_TOOL,
    GET_RESCUES_TOOL,
    GET_PAYROLL_WEEK_TOOL,
]

#runs the agent and connects the message to the LLM
def run_operations_agent(user: CurrentUser, message: str, history=None) -> str:
    
    client = get_openai_client()
    system_prompt = build_system_prompt()

  #replay earlier turns first, then the new question, so "how many is that?" works
    messages = [{"role": "system", "content": system_prompt}]

    for turn in (history or [])[-MAX_HISTORY_TURNS:]:
        messages.append({"role": turn.role, "content": turn.text})

    messages.append({"role": "user", "content": message})

    #max loop of 5 for conversation
    for _ in range(5):
        response = client.chat.completions.create( # type: ignore
            model = MODEL,
            messages = messages,
            tools = TOOLS,
        )
        reply = response.choices[0].message

        #exiting loop
        if not reply.tool_calls:
            return reply.content or ""
        
        #after loop exited or final call done
        messages.append(reply)
        for call in reply.tool_calls:
            result = run_tool(user, call.function.name, call.function.arguments)
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result),
            })

    return "Sorry, I could not complete that request."
        
#allows the agent to run certain tools and recieve information/data
def run_tool(user: CurrentUser, name: str, arguments_json: str):
    
    #Send a tool call, by name, to the matching Python function
    args = json.loads(arguments_json or "{}")

    if name == "list_drivers":
        return run_list_drivers(user, status=args.get("status"))
    
    if name == "get_schedule":
        return run_get_schedule(user, work_date=args.get("work_date"))

    if name == "get_time_off":
        return run_get_time_off(
            user,
            start=args.get("start"),
            end=args.get("end"),
            exception_type=args.get("exception_type"),
        )

    if name == "get_driver":
        return run_get_driver(user, name=args.get("name"))

    if name == "get_driver_attendance":
        return run_get_driver_attendance(
            user,
            name=args.get("name"),
            start=args.get("start"),
            end=args.get("end"),
        )

    if name == "get_week_schedule":
        return run_get_week_schedule(user, week_start=args.get("week_start"))

    if name == "get_driver_schedule":
        return run_get_driver_schedule(
            user,
            name=args.get("name"),
            start=args.get("start"),
            end=args.get("end"),
        )

    if name == "get_makeup_days":
        return run_get_makeup_days(user)

    if name == "find_available_drivers":
        return run_find_available_drivers(user, work_date=args.get("work_date"))

    if name == "get_staffing_gaps":
        return run_get_staffing_gaps(user, work_date=args.get("work_date"))

    if name == "get_daily_report":
        return run_get_daily_report(user, report_date=args.get("report_date"))

    if name == "get_open_issues":
        return run_get_open_issues(user, start=args.get("start"), end=args.get("end"))

    if name == "get_rescues":
        return run_get_rescues(user, report_date=args.get("report_date"))

    if name == "get_payroll_week":
        return run_get_payroll_week(user, week_start=args.get("week_start"))

    return {"error": f"Unknown tool: {name}"}