var title = "區間測速";
var question = "花花公路設有區間測速系統，其平均速率計算方式為總距離除以行駛時間。\n已知花花公路全長10公里，最低速限60公里，最高速限80公里。\n若車輛平均速率低於最低速限，罰款3000元；\n高於最高速限1公里~20公里，罰款4000元；\n高於最高速限21公里~40公里，罰款5000元；\n高於最高速限超過40公里，罰款6000元；\n\n請設計區間測速罰單系統，根據行駛時間(分鐘)，顯示罰款金額。\n";
var array = [
    /*["夜市牛排", "200"],
    ["藥燉排骨", "120"],
    ["炸雞排", "60"],
    ["奶茶", "55"],
    ["臭豆腐", "40"],
    ["地瓜球", "30"]*/
]
var test_case = [
    {
        input: "12",
        output: "罰款3000元",
        note: "行駛12分鐘，為0.2小時，平均速率為10/0.2=50(km/h)，低於最低速限，罰款3000元。"
    },
    {
        input: "8",
        output: "罰款0元",
        note: "行駛8分鐘，為0.133小時，平均速率約為10/0.133=75(km/h)，在標準內，罰款0元。"
    }
]

$(document).ready(function(){
    $("#question_name").text("題目名稱："+title)
    $("#question_info").text(question);
    $("#example_testcase").append(
        '<tr>\
            <th style="width: 20%;">輸入</th>\
            <th style="width: 20%;">輸出</th>\
            <th style="width: 30%;">說明</th>\
        </tr>'
    )    
    for(let i=0;i<test_case.length;i++){
        $("#example_testcase").append(
            '<tr>\
                <td style="width: 20%;">'+test_case[i].input+'</td>\
                <td style="width: 20%;">'+test_case[i].output+'</td>\
                <td style="width: 30%;">'+test_case[i].note+'</td>\
            </tr>'
        )  
    }
    for(let i=0;i<array.length;i++){
        $("#array").append(
            '<tr>\
                <td style="width: 20%;">'+array[i][0]+'</td>\
                <td style="width: 20%;">'+array[i][1]+'</td>\
            </tr>'
        )  
    }
    
})