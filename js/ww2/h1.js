var title = "郵資";
var question = "在寄包裹時，郵局會先計算總共要處理幾個包裹，再根據每個包裹的重量來計算總共的郵資。請寫程式計算郵資。\n";
var array = [
    ["重量限制", "郵資費用"],
    ["不逾5公斤", "70"],
    ["逾5公斤、不逾10公斤", "90"],
    ["逾10公斤、不逾15公斤", "110"],
    ["逾15公斤、不逾20公斤", "135"]
]
var test_case = [
    {
        input: "3\n2 3 5",
        output: "210",
        note: "總共寄出3個包裹，分別為2公斤、3公斤、5公斤，郵資皆為70元，共210元。。"
    },
    {
        input: "4\n6 11 16 20",
        output: "470",
        note: "總共寄出3個包裹，分別為6公斤、11公斤、16公斤、20公斤，郵資分別為90元、110元、135元、135元，共470元。"
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
                <td style="width: 20%;">'+test_case[i].input.replaceAll("\n","<br>")+'</td>\
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